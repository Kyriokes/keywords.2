import { authenticateAgent } from "@/lib/agent/auth";
import { handleMcpMessage, type JsonRpcResponse } from "@/lib/agent/mcp";
import { SERVER_INSTRUCTIONS, agentTools } from "@/lib/agent/tools";
import { isRateLimited } from "@/lib/rateLimit";

// Servidor MCP para agentes como Claude Code. No usa la sesión con cookie: se autentica con
// el token personal que el usuario genera en KeyWords (ruta pública en el proxy).

const MAX_BODY_BYTES = 1_000_000;
const RATE_LIMIT = { max: 120, windowMs: 60_000 };

const SERVER_INFO = { name: "keywords", version: "0.1.0", instructions: SERVER_INSTRUCTIONS };

export async function POST(request: Request) {
    const agent = await authenticateAgent(request);
    if (!agent) {
        return Response.json(
            { error: "Token inválido o revocado. Generá uno en KeyWords > Conectar Claude Code." },
            { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="keywords"' } }
        );
    }

    if (isRateLimited(`mcp:${agent.tokenId}`, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
        return Response.json({ error: "Demasiados pedidos, esperá un minuto." }, { status: 429 });
    }

    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
        return Response.json({ error: "Pedido demasiado grande." }, { status: 413 });
    }

    let message: unknown;
    try {
        message = JSON.parse(body);
    } catch {
        return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
    }

    // Versiones viejas del protocolo permiten mandar varios mensajes juntos
    if (Array.isArray(message)) {
        const responses = (await Promise.all(
            message.map((item) => handleMcpMessage(item, agent, agentTools, SERVER_INFO))
        )).filter((response): response is JsonRpcResponse => response !== null);
        return responses.length ? Response.json(responses) : new Response(null, { status: 202 });
    }

    const response = await handleMcpMessage(message, agent, agentTools, SERVER_INFO);
    return response ? Response.json(response) : new Response(null, { status: 202 });
}

// Sin sesiones ni notificaciones del servidor: no hay stream que abrir ni sesión que cerrar
export function GET() {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
