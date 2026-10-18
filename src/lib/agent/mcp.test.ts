import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToolError, defineTool, handleMcpMessage } from "./mcp";

type Ctx = { user: string };

const info = { name: "test", version: "1.0.0", instructions: "Usá las herramientas." };

const echo = defineTool({
    name: "echo",
    description: "Devuelve el texto",
    input: z.object({ text: z.string().min(1) }),
    run: async (ctx: Ctx, input) => ({ user: ctx.user, text: input.text }),
});

const failing = defineTool({
    name: "failing",
    description: "Falla",
    input: z.object({ expected: z.boolean() }),
    run: async (_ctx: Ctx, input) => {
        if (input.expected) throw new ToolError("No existe esa oferta.");
        throw new Error("secreto interno");
    },
});

const tools = [echo, failing];
const call = (message: unknown) => handleMcpMessage(message, { user: "u1" }, tools, info);

describe("handleMcpMessage", () => {
    it("negocia la versión del protocolo en initialize", async () => {
        const known = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
        expect(known?.result).toMatchObject({
            protocolVersion: "2025-03-26",
            serverInfo: { name: "test" },
            instructions: info.instructions,
        });

        const unknown = await call({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
        expect(unknown?.result).toMatchObject({ protocolVersion: "2025-06-18" });
    });

    it("no responde notificaciones ni respuestas del cliente", async () => {
        expect(await call({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
        expect(await call({ jsonrpc: "2.0", id: 5, result: {} })).toBeNull();
    });

    it("lista las herramientas con su schema de entrada", async () => {
        const response = await call({ jsonrpc: "2.0", id: 3, method: "tools/list" });
        const listed = (response?.result as { tools: { name: string; inputSchema: { properties: object } }[] }).tools;
        expect(listed.map((tool) => tool.name)).toEqual(["echo", "failing"]);
        expect(listed[0].inputSchema.properties).toHaveProperty("text");
    });

    it("ejecuta la herramienta con el contexto del usuario", async () => {
        const response = await call({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "echo", arguments: { text: "hola" } } });
        const result = response?.result as { content: { text: string }[]; isError?: boolean };
        expect(result.isError).toBeUndefined();
        expect(JSON.parse(result.content[0].text)).toEqual({ user: "u1", text: "hola" });
    });

    it("devuelve los datos inválidos como error de la herramienta", async () => {
        const response = await call({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "echo", arguments: { text: "" } } });
        expect(response?.result).toMatchObject({ isError: true });
    });

    it("muestra los errores esperados y oculta los internos", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const expected = await call({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "failing", arguments: { expected: true } } });
        expect(JSON.stringify(expected)).toContain("No existe esa oferta.");

        const internal = await call({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "failing", arguments: { expected: false } } });
        expect(JSON.stringify(internal)).not.toContain("secreto interno");
        expect(internal?.result).toMatchObject({ isError: true });
        spy.mockRestore();
    });

    it("responde errores JSON-RPC para métodos o herramientas desconocidas y mensajes inválidos", async () => {
        expect((await call({ jsonrpc: "2.0", id: 9, method: "resources/list" }))?.error?.code).toBe(-32601);
        expect((await call({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "nope" } }))?.error?.code).toBe(-32602);
        expect((await call({ method: "x", id: 11 }))?.error?.code).toBe(-32600);
    });
});
