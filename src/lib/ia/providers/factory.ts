import { AiProvider } from "./types";
import { GroqProvider } from "./groq";
import { OllamaProvider } from "./ollama";
import { GeminiProvider } from "./gemini";
import { DeepSeekProvider } from "./deepseek";
import { providerManager } from "../providerManager";

export function getAiProvider(excludeIds: string[] = []): AiProvider {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const preferredProvider = process.env.AI_PROVIDER;

    // Definitions
    const factories: Record<string, () => AiProvider | null> = {
        "groq": () => groqKey ? new GroqProvider(groqKey) : null,
        "gemini": () => geminiKey ? new GeminiProvider(geminiKey) : null,
        "deepseek": () => deepseekKey ? new DeepSeekProvider(deepseekKey) : null,
        "ollama": () => new OllamaProvider()
    };

    // 1. Force Preferred (Debug/Manual override)
    if (preferredProvider && !excludeIds.includes(preferredProvider)) {
        const factory = factories[preferredProvider];
        if (factory) {
            const instance = factory();
            if (instance) return instance;
        }
    }

    // 2. Identify Premium Candidates (Valid keys)
    const premiumCandidates: string[] = [];
    if (groqKey) premiumCandidates.push("groq");
    if (geminiKey) premiumCandidates.push("gemini");
    if (deepseekKey) premiumCandidates.push("deepseek");
    // Add future providers here

    // 3. Select via Manager (Weighted Random, excluding Paused/Excluded)
    const selectedId = providerManager.selectProvider(premiumCandidates, excludeIds);

    if (selectedId) {
        const instance = factories[selectedId]();
        if (instance) return instance;
    }

    // 4. Fallback: Ollama
    // Only if all premium are excluded, paused, or failed to instantiate
    // (Ollama is the safety net)
    console.log("[Factory] All premium providers unavailable. Falling back to Ollama.");
    return new OllamaProvider();
}
