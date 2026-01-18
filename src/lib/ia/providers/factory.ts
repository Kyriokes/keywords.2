import { AiProvider } from "./types";
import { GroqProvider } from "./groq";
import { OllamaProvider } from "./ollama";

export function getAiProvider(): AiProvider {
    const providerType = process.env.AI_PROVIDER || "ollama";
    
    if (providerType === "groq") {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.warn("GROQ_API_KEY is missing, falling back to Ollama");
            return new OllamaProvider();
        }
        return new GroqProvider(apiKey);
    }

    // Default to Ollama
    return new OllamaProvider();
}
