import { AiProvider, HealthCheckResult } from "./types";
import { HfInference } from "@huggingface/inference";

export class HuggingFaceProvider implements AiProvider {
    id = "huggingface";
    name = "HuggingFace (Qwen)";
    
    private client: HfInference;
    private model: string;

    constructor(apiKey: string, model: string = "Qwen/Qwen2.5-Coder-3B-Instruct") {
        this.client = new HfInference(apiKey);
        this.model = model;
    }

    async generate(prompt: string): Promise<string> {
        try {
            const completion = await this.client.chatCompletion({
                model: this.model,
                messages: [
                    { role: "user", content: prompt }
                ],
                max_tokens: 1024,
                temperature: 0.1, // Recomendado para coding
                top_p: 0.95,
            });

            return completion.choices[0]?.message?.content || "";
        } catch (error) {
            console.error("HuggingFace Provider Error:", error);
            throw error;
        }
    }

    async checkHealth(): Promise<HealthCheckResult> {
        try {
            await this.client.chatCompletion({
                model: this.model,
                messages: [{ role: "user", content: "ping" }],
                max_tokens: 1,
            });
            return { ok: true };
        } catch (e: unknown) {
            console.error("HuggingFace Health Check Failed:", e);
            if (e instanceof Error) {
                if (e.message.includes("depleted your monthly included credits") || e.message.includes("Purchase pre-paid credits")) {
                    return { ok: false, error: "Créditos agotados (Hugging Face Billing)" };
                }
                return { ok: false, error: e.message };
            }
            return { ok: false, error: "Error desconocido" };
        }
    }
}