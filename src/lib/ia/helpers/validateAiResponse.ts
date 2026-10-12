import type { AiResponse } from "../types";
import { LIMITS } from "@/lib/validation";

export function validateAiResponse(obj: unknown): obj is AiResponse {
    if (!obj || typeof obj !== "object") return false;
    const candidate = obj as { palabrasClave?: unknown; puesto?: unknown };
    if (!Array.isArray(candidate.palabrasClave)) return false;
    for (const p of candidate.palabrasClave) {
        if (!p || typeof p !== "object") return false;
        if (typeof p.nombre !== "string") return false;
        if (typeof p.cantidad !== "number") return false;
    }
    if (candidate.puesto !== undefined && typeof candidate.puesto !== "string") return false;
    return true;
}

/**
 * Acota lo que devolvió el modelo: el texto de la oferta lo escribe un tercero y puede
 * inducirlo a responder con listas enormes o strings arbitrariamente largos.
 */
export function limitAiResponse(response: AiResponse): AiResponse {
    const palabrasClave = response.palabrasClave
        .map((keyword) => ({ nombre: keyword.nombre.trim(), cantidad: keyword.cantidad }))
        .filter((keyword) => keyword.nombre.length > 0 && keyword.nombre.length <= LIMITS.keywordLength)
        .slice(0, LIMITS.applicationKeywords);

    const puesto = response.puesto?.trim().slice(0, LIMITS.title) || undefined;

    return { palabrasClave, puesto };
}

export default validateAiResponse;
