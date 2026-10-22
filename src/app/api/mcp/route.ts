import { authenticateAgent } from "@/lib/agent/auth";
import { MAX_BATCH, handleMcpPayload } from "@/lib/agent/mcp";
import { SERVER_INSTRUCTIONS, SERVER_VERSION, agentTools } from "@/lib/agent/tools";
import { isRateLimited } from "@/lib/rateLimit";

// Servidor MCP para agentes como Claude Code. No usa la sesión con cookie: se autentica con
// el token personal que el usuario genera en KeyWords (ruta pública en el proxy).

const MAX_BODY_BYTES = 1_000_000;
const RATE_LIMIT = { max: 120, windowMs: 60_000 };

const SERVER_INFO = { name: "keywords", version: SERVER_VERSION, instructions: SERVER_INSTRUCTIONS };

const tooLarge = () => Response.json({ error: "Pedido demasiado grande." }, { status: 413 });

export async function POST(request: Request) {
    const agent = await authenticateAgent(request);
    if (!agent) {
        return Response.json(
            { error: "Token inválido o revocado. Generá uno en KeyWords > Conectar Claude Code." },
            { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="keywords"' } }
        );
    }

    const rateKey = `mcp:${agent.tokenId}`;
    const tooMany = () => Response.json({ error: "Demasiados pedidos, esperá un minuto." }, { status: 429 });
    if (isRateLimited(rateKey, RATE_LIMIT.max, RATE_LIMIT.windowMs)) return tooMany();

    // Corte por el tamaño declarado antes de leer el cuerpo en memoria
    if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return tooLarge();
    const body = await request.text();
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return tooLarge();

    let message: unknown;
    try {
        message = JSON.parse(body);
    } catch {
        return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
    }

    // Cada mensaje de un lote cuenta para el límite, no el lote entero como uno solo (el primero ya se contó)
    if (Array.isArray(message) && message.length > 1) {
        const extra = Math.min(message.length, MAX_BATCH + 1) - 1;
        if (isRateLimited(rateKey, RATE_LIMIT.max, RATE_LIMIT.windowMs, extra)) return tooMany();
    }

    const response = await handleMcpPayload(message, agent, agentTools, SERVER_INFO);
    return response ? Response.json(response) : new Response(null, { status: 202 });
}

// Sin sesiones ni notificaciones del servidor: no hay stream que abrir ni sesión que cerrar
export function GET() {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
