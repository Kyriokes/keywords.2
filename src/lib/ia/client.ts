import { getAiProvider } from "./providers/factory";
import type { McpOptions } from "./types";
import { providerManager } from "./providerManager";

export async function postToMcp(
    prompt: string,
    opts?: McpOptions
): Promise<{ text: string; providerId: string }> {
    const maxRetries = 5;
    let attempts = 0;
    const currentExcludes = [...(opts?.excludeProviders || [])];

    while (attempts < maxRetries) {
        // 1. Get Provider
        const provider = getAiProvider(currentExcludes);
        const pid = provider.id;

        try {
            console.log(`[Client] Attempt ${attempts + 1}: Using provider ${pid}`);
            
            // 2. Generate
            const text = await provider.generate(prompt);
            
            // 3. Success (Technical)
            // Note: Business logic rejection happens later via API
            providerManager.logGeneration(pid);
            
            return { text, providerId: pid };

        } catch (error) {
            console.error(`[Client] Provider ${pid} failed:`, error);
            
            // 4. Failure
            providerManager.reportFailure(pid);
            currentExcludes.push(pid);
            
            // getAiProvider returns Ollama as the *last* resort: if it failed there is nothing left to try.
            if (pid === 'ollama') {
                console.error("[Client] Fallback provider (Ollama) failed. Aborting.");
                throw error;
            }
        }
        
        attempts++;
    }

    throw new Error("All AI providers failed.");
}
