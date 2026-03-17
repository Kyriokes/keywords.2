import { AiProvider } from "./types";
import { GroqProvider } from "./groq";
import { OllamaProvider } from "./ollama";
import { GeminiProvider } from "./gemini";
import { DeepSeekProvider } from "./deepseek";
import { OpenRouterProvider } from "./openrouter";
import { HuggingFaceProvider } from "./huggingface";
import { CerebrasProvider } from "./cerebras";
import { MistralProvider } from "./mistral";
import { CohereProvider } from "./cohere";
import { providerManager } from "../providerManager";

export function createProvider(id: string): AiProvider | null {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const openrouterKey = process.env.OPENROUTERAI_API_KEY;
    const huggingfaceKey = process.env.HUGGINGFACE_API_KEY;
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;
    const cohereKey = process.env.COHERE_API_KEY;

    switch (id) {
        case "groq": return groqKey ? new GroqProvider(groqKey) : null;
        case "gemini": return geminiKey ? new GeminiProvider(geminiKey) : null;
        case "deepseek": return deepseekKey ? new DeepSeekProvider(deepseekKey) : null;
        case "openrouter": return openrouterKey ? new OpenRouterProvider(openrouterKey) : null;
        case "huggingface": return huggingfaceKey ? new HuggingFaceProvider(huggingfaceKey) : null;
        case "cerebras": return cerebrasKey ? new CerebrasProvider(cerebrasKey) : null;
        case "mistral": return mistralKey ? new MistralProvider(mistralKey) : null;
        case "cohere": return cohereKey ? new CohereProvider(cohereKey) : null;
        case "ollama": return new OllamaProvider();
        default: return null;
    }
}

export function getAiProvider(excludeIds: string[] = []): AiProvider {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const openrouterKey = process.env.OPENROUTERAI_API_KEY;
    const huggingfaceKey = process.env.HUGGINGFACE_API_KEY;
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;
    const cohereKey = process.env.COHERE_API_KEY;
    const preferredProvider = process.env.AI_PROVIDER;

    // Definitions
    const factories: Record<string, () => AiProvider | null> = {
        "groq": () => groqKey ? new GroqProvider(groqKey) : null,
        "gemini": () => geminiKey ? new GeminiProvider(geminiKey) : null,
        "deepseek": () => deepseekKey ? new DeepSeekProvider(deepseekKey) : null,
        "openrouter": () => openrouterKey ? new OpenRouterProvider(openrouterKey) : null,
        "huggingface": () => huggingfaceKey ? new HuggingFaceProvider(huggingfaceKey) : null,
        "cerebras": () => cerebrasKey ? new CerebrasProvider(cerebrasKey) : null,
        "mistral": () => mistralKey ? new MistralProvider(mistralKey) : null,
        "cohere": () => cohereKey ? new CohereProvider(cohereKey) : null,
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
    if (openrouterKey) premiumCandidates.push("openrouter");
    if (huggingfaceKey) premiumCandidates.push("huggingface");
    if (cerebrasKey) premiumCandidates.push("cerebras");
    if (mistralKey) premiumCandidates.push("mistral");
    if (cohereKey) premiumCandidates.push("cohere");
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
