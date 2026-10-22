import { z } from "zod";

/**
 * Servidor MCP mínimo sobre HTTP, sin estado: cada POST trae un mensaje JSON-RPC y la respuesta
 * va en el mismo request como JSON. Alcanza para exponer herramientas; no usa streams ni sesiones.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** Mensajes que puede traer un lote. Un cliente real manda uno o dos; más es abuso. */
export const MAX_BATCH = 20;

export interface McpTool<Ctx> {
    name: string;
    description: string;
    input: z.ZodType;
    /** Lo que devuelve se manda al agente como JSON. Un `ToolError` se muestra como error de la herramienta. */
    run: (ctx: Ctx, input: never) => Promise<unknown>;
}

/** Define una herramienta con el tipo de su input deducido del schema. */
export function defineTool<Ctx, S extends z.ZodType>(tool: {
    name: string;
    description: string;
    input: S;
    run: (ctx: Ctx, input: z.output<S>) => Promise<unknown>;
}): McpTool<Ctx> {
    return tool as McpTool<Ctx>;
}

/** Error esperado (oferta inexistente, límite alcanzado...): el agente recibe el mensaje tal cual. */
export class ToolError extends Error {}

export interface ServerInfo {
    name: string;
    version: string;
    instructions?: string;
}

type JsonRpcId = string | number | null;

export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: JsonRpcId;
    result?: unknown;
    error?: { code: number; message: string };
}

const requestSchema = z.object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string(), z.number()]).optional(),
    method: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
});

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
});

const textResult = (value: unknown, isError = false) => ({
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
});

export function toolListing<Ctx>(tools: McpTool<Ctx>[]) {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        // El agente ve lo que tiene que mandar, antes de las transformaciones del schema
        inputSchema: z.toJSONSchema(tool.input, { io: "input", unrepresentable: "any" }),
    }));
}

/**
 * Procesa un mensaje JSON-RPC. Devuelve null para notificaciones y respuestas del cliente,
 * que no llevan respuesta.
 */
export async function handleMcpMessage<Ctx>(
    message: unknown,
    ctx: Ctx,
    tools: McpTool<Ctx>[],
    info: ServerInfo
): Promise<JsonRpcResponse | null> {
    const parsed = requestSchema.safeParse(message);
    if (!parsed.success) {
        // Una respuesta del cliente (tiene result o error, no method) no se contesta
        if (message && typeof message === "object" && !("method" in message) && "id" in message) return null;
        return fail(null, -32600, "Invalid Request");
    }

    const { id, method, params } = parsed.data;
    if (id === undefined) return null; // Notificación (ej: notifications/initialized)

    switch (method) {
        case "initialize": {
            const requested = params?.protocolVersion;
            const protocolVersion = (SUPPORTED_PROTOCOL_VERSIONS as readonly unknown[]).includes(requested)
                ? (requested as string)
                : LATEST_PROTOCOL_VERSION;
            return ok(id, {
                protocolVersion,
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: info.name, version: info.version },
                ...(info.instructions ? { instructions: info.instructions } : {}),
            });
        }

        case "ping":
            return ok(id, {});

        case "tools/list":
            return ok(id, { tools: toolListing(tools) });

        case "tools/call": {
            const tool = tools.find((candidate) => candidate.name === params?.name);
            if (!tool) return fail(id, -32602, `Unknown tool: ${String(params?.name)}`);

            const input = tool.input.safeParse(params?.arguments ?? {});
            if (!input.success) {
                const issues = input.error.issues
                    .map((issue) => `${issue.path.join(".") || "(input)"}: ${issue.message}`)
                    .join("; ");
                return ok(id, textResult(`Datos inválidos: ${issues}`, true));
            }

            try {
                return ok(id, textResult(await tool.run(ctx, input.data as never)));
            } catch (error) {
                if (error instanceof ToolError) return ok(id, textResult(error.message, true));
                console.error(`MCP tool ${tool.name} failed:`, error);
                return ok(id, textResult("Error interno al ejecutar la herramienta.", true));
            }
        }

        default:
            return fail(id, -32601, `Method not found: ${method}`);
    }
}

/**
 * Procesa lo que llegó en un POST: un mensaje o, en las versiones viejas del protocolo, un lote.
 * Los mensajes de un lote se procesan de a uno, para que un lote no dispare decenas de consultas
 * a la vez, y un lote más grande que MAX_BATCH se rechaza entero sin ejecutar nada.
 */
export async function handleMcpPayload<Ctx>(
    payload: unknown,
    ctx: Ctx,
    tools: McpTool<Ctx>[],
    info: ServerInfo
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    if (!Array.isArray(payload)) return handleMcpMessage(payload, ctx, tools, info);
    if (payload.length === 0) return fail(null, -32600, "Invalid Request: empty batch");
    if (payload.length > MAX_BATCH) return fail(null, -32600, `Invalid Request: batch larger than ${MAX_BATCH}`);

    const responses: JsonRpcResponse[] = [];
    for (const message of payload) {
        const response = await handleMcpMessage(message, ctx, tools, info);
        if (response) responses.push(response);
    }
    return responses.length ? responses : null;
}
