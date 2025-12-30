export interface AiKeyword {
    nombre: string;
    cantidad: number;
}

export interface AiResponse {
    palabrasClave: AiKeyword[];
    puesto?: string;
}

export interface McpOptions {
    url?: string;
    model?: string;
    timeoutMs?: number;
}
