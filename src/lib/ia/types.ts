export interface AiKeyword {
    nombre: string;
    cantidad: number;
}

export interface AiResponse {
    titulo: string;
    palabrasClave: AiKeyword[];
}

export interface McpOptions {
    url?: string;
    model?: string;
    timeoutMs?: number;
}
