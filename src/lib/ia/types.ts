export interface AiKeyword {
    nombre: string;
    cantidad: number;
    /** false si el término todavía no está en el diccionario. Ausente si no se pudo consultar. */
    verificada?: boolean;
}

export interface AiResponse {
    palabrasClave: AiKeyword[];
    puesto?: string;
    /** Rol estandarizado y nivel que el diccionario deduce de `puesto`. */
    rol?: string;
    seniority?: string;
    provider?: string;
}

export interface McpOptions {
    excludeProviders?: string[];
}

// Los errores esperados viajan como valor de retorno: en producción Next oculta
// el mensaje de los errores lanzados por una server action.
export type ProcessJobResult =
    | { ok: true; data: AiResponse }
    | { ok: false; code: "QUOTA_EXCEEDED"; usedToday: number; limit: number; resetsAt: Date }
    | { ok: false; code: "UNAUTHENTICATED" | "INVALID_INPUT" | "AI_SERVICE_UNAVAILABLE" };
