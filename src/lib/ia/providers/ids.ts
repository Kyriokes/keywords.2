// Sin dependencias de servidor: lo importan tanto el backend como componentes cliente.
export const PROVIDER_IDS = [
    "groq",
    "gemini",
    "deepseek",
    "openrouter",
    "huggingface",
    "cerebras",
    "mistral",
    "cohere",
    "ollama",
] as const;

export type ProviderId = typeof PROVIDER_IDS[number];

export function isProviderId(value: unknown): value is ProviderId {
    return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}
