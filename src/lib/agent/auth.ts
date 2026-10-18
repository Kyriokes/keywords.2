import "server-only";

import prisma from "@/lib/prisma";
import { hashAgentToken, parseBearerToken } from "./tokens";

export interface AgentContext {
    userId: string;
    profileId: string;
    tokenId: string;
}

// No se actualiza `lastUsedAt` en cada llamada: alcanza con saber el uso aproximado
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

/**
 * Resuelve el usuario y el perfil de un request del agente a partir de su token.
 * Devuelve null si el token falta, no existe o fue revocado.
 */
export async function authenticateAgent(request: Request): Promise<AgentContext | null> {
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) return null;

    const record = await prisma.agentToken.findUnique({
        where: { tokenHash: hashAgentToken(token) },
        select: {
            id: true,
            revokedAt: true,
            lastUsedAt: true,
            user: { select: { id: true, profile: { select: { id: true } } } },
        },
    });
    if (!record || record.revokedAt || !record.user.profile) return null;

    if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
        prisma.agentToken
            .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
            .catch(console.error);
    }

    return { userId: record.user.id, profileId: record.user.profile.id, tokenId: record.id };
}
