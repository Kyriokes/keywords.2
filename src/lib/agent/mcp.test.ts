import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MAX_BATCH, ToolError, defineTool, handleMcpMessage, handleMcpPayload } from "./mcp";

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

describe("handleMcpPayload", () => {
    const echoCall = (id: number) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "echo", arguments: { text: `t${id}` } } });

    it("un lote demasiado grande se rechaza entero, sin ejecutar ninguna herramienta", async () => {
        const run = vi.fn(async () => ({}));
        const counted = [defineTool({ name: "echo", description: "", input: z.object({ text: z.string() }), run })];

        const response = await handleMcpPayload(Array.from({ length: MAX_BATCH + 1 }, (_, i) => echoCall(i)), { user: "u1" }, counted, info);

        expect(run).not.toHaveBeenCalled();
        expect(response).toMatchObject({ jsonrpc: "2.0", id: null, error: { code: -32600 } });
    });

    it("procesa un lote de a un mensaje, en orden, y omite las notificaciones", async () => {
        const order: string[] = [];
        const slow = defineTool({
            name: "echo",
            description: "",
            input: z.object({ text: z.string() }),
            run: async (_ctx: Ctx, input) => {
                order.push(`start ${input.text}`);
                await new Promise((resolve) => setTimeout(resolve, input.text === "t1" ? 20 : 0));
                order.push(`end ${input.text}`);
                return input.text;
            },
        });

        const response = await handleMcpPayload([echoCall(1), { jsonrpc: "2.0", method: "notifications/initialized" }, echoCall(2)], { user: "u1" }, [slow], info);

        expect(order).toEqual(["start t1", "end t1", "start t2", "end t2"]);
        expect((response as { id: number }[]).map((item) => item.id)).toEqual([1, 2]);
    });

    it("un lote vacío es un pedido inválido y uno de solo notificaciones no lleva respuesta", async () => {
        expect(await handleMcpPayload([], { user: "u1" }, tools, info)).toMatchObject({ error: { code: -32600 } });
        expect(await handleMcpPayload([{ jsonrpc: "2.0", method: "notifications/initialized" }], { user: "u1" }, tools, info)).toBeNull();
    });

    it("un mensaje suelto se procesa como siempre", async () => {
        expect(await handleMcpPayload(echoCall(3), { user: "u1" }, tools, info)).toMatchObject({ id: 3 });
    });
});
