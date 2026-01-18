import { getAiProvider } from "./providers/factory";
import type { McpOptions } from "./types";

export async function postToMcp(
    prompt: string,
    opts?: McpOptions
): Promise<string> {
    // Utilizar el proveedor configurado (Grok o Ollama)
    const provider = getAiProvider();
    
    // Si se necesitara pasar opciones específicas (como timeout), 
    // se podrían implementar en la interfaz AiProvider más adelante.
    // Por ahora, delegamos la generación al proveedor.
    return provider.generate(prompt);
}
