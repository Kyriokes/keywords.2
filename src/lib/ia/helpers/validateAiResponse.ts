import type { AiResponse } from "../types";

export function validateAiResponse(obj: any): obj is AiResponse {
    if (!obj || typeof obj !== "object") return false;
    if (typeof obj.titulo !== "string") return false;
    if (!Array.isArray(obj.palabrasClave)) return false;
    for (const p of obj.palabrasClave) {
        if (typeof p.nombre !== "string") return false;
        if (typeof p.cantidad !== "number") return false;
    }
    return true;
}

export default validateAiResponse;
