import type { Metadata } from "next";
import { headers } from "next/headers";
import { listAgentTokens } from "@/actions/agent-token-actions";
import { AgentConnect } from "@/components/AgentConnect";

export const metadata: Metadata = { title: "Conectar Claude Code" };

export default async function ConnectPage() {
    const [tokens, requestHeaders] = await Promise.all([listAgentTokens(), headers()]);

    // La URL sale del propio request: sirve igual en producción, en previews y en local
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "kwtools.vercel.app";
    const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const mcpUrl = `${protocol}://${host}/api/mcp`;

    return (
        <div className="container mx-auto max-w-3xl space-y-8 px-4 py-8">
            <div className="space-y-3">
                <h1 className="text-3xl font-semibold sm:text-4xl">Conectar Claude Code</h1>
                <p className="text-muted-foreground">
                    Con Claude Code conectado, Claude puede leer tu cola de ofertas aprobadas, completar los
                    formularios de postulación en tu navegador y dejar registrado acá qué respondió y qué CV usó.
                    Antes de enviar cada postulación te pide confirmación. No postula en LinkedIn ni en Indeed.
                </p>
            </div>
            <AgentConnect initialTokens={tokens} mcpUrl={mcpUrl} />
        </div>
    );
}
