import { createHash, randomBytes } from "node:crypto";

/** Prefijo visible de los tokens: permite reconocerlos (y detectarlos si se filtran en un repo). */
export const AGENT_TOKEN_PREFIX = "kw_";

const TOKEN_PATTERN = /^kw_[A-Za-z0-9_-]{43}$/;

/** Token nuevo: 32 bytes aleatorios en base64url. Se muestra una sola vez; en la base queda el hash. */
export function generateAgentToken(): string {
    return AGENT_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashAgentToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

/** Los primeros caracteres del token, para identificarlo en la lista sin revelarlo. */
export function tokenDisplayPrefix(token: string): string {
    return token.slice(0, AGENT_TOKEN_PREFIX.length + 6);
}

/** Extrae el token de un header `Authorization: Bearer kw_...`; null si falta o no tiene el formato. */
export function parseBearerToken(header: string | null): string | null {
    const match = header?.match(/^Bearer\s+(\S+)$/i);
    if (!match) return null;
    return TOKEN_PATTERN.test(match[1]) ? match[1] : null;
}
