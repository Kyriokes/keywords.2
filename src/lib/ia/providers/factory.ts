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
import type { ProviderId } from "./ids";

type PremiumProviderId = Exclude<ProviderId, "ollama">;

// Proveedores que requieren API key. Para agregar uno nuevo alcanza con sumarlo acá y en ids.ts.
const premiumProviders: Record<PremiumProviderId, { envKey: string; create: (apiKey: string) => AiProvider }> = {
    groq: { envKey: "GROQ_API_KEY", create: (key) => new GroqProvider(key) },
    gemini: { envKey: "GEMINI_API_KEY", create: (key) => new GeminiProvider(key) },
    deepseek: { envKey: "DEEPSEEK_API_KEY", create: (key) => new DeepSeekProvider(key) },
    openrouter: { envKey: "OPENROUTERAI_API_KEY", create: (key) => new OpenRouterProvider(key) },
    huggingface: { envKey: "HUGGINGFACE_API_KEY", create: (key) => new HuggingFaceProvider(key) },
    cerebras: { envKey: "CEREBRAS_API_KEY", create: (key) => new CerebrasProvider(key) },
    mistral: { envKey: "MISTRAL_API_KEY", create: (key) => new MistralProvider(key) },
    cohere: { envKey: "COHERE_API_KEY", create: (key) => new CohereProvider(key) },
};

const premiumIds = Object.keys(premiumProviders) as PremiumProviderId[];

function isPremiumId(id: string): id is PremiumProviderId {
    return Object.prototype.hasOwnProperty.call(premiumProviders, id);
}

export function createProvider(id: string): AiProvider | null {
    if (id === "ollama") return new OllamaProvider();
    if (!isPremiumId(id)) return null;

    const { envKey, create } = premiumProviders[id];
    const apiKey = process.env[envKey];
    return apiKey ? create(apiKey) : null;
}

export function getAiProvider(excludeIds: string[] = []): AiProvider {
    const preferredProvider = process.env.AI_PROVIDER;

    // 1. Force Preferred (Debug/Manual override)
    if (preferredProvider && !excludeIds.includes(preferredProvider)) {
        const instance = createProvider(preferredProvider);
        if (instance) {
            console.log(`[Factory] Forcing provider ${preferredProvider} via AI_PROVIDER env var`);
            return instance;
        }
    }

    // 2. Identify Premium Candidates (Valid keys)
    const premiumCandidates = premiumIds.filter((id) => !!process.env[premiumProviders[id].envKey]);

    // 3. Select via Manager (Weighted Random, excluding Paused/Excluded)
    const selectedId = providerManager.selectProvider(premiumCandidates, excludeIds);

    if (selectedId) {
        const instance = createProvider(selectedId);
        if (instance) return instance;
    }

    // 4. Fallback: Ollama
    // Only if all premium are excluded, paused, or failed to instantiate
    if (!excludeIds.includes("ollama")) {
        console.log("[Factory] All premium providers unavailable. Falling back to Ollama.");
        return new OllamaProvider();
    }
    throw new Error("No providers available.");
}
