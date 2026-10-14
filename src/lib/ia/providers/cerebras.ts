import { AiProvider, HealthCheckResult } from "./types";
import OpenAI from "openai";

export class CerebrasProvider implements AiProvider {
    id = "cerebras";
    name = "Cerebras (Qwen 3.8)";
    
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = "qwen-3.8-27b") {
        this.client = new OpenAI({
            baseURL: 'https://api.cerebras.ai/v1',
            apiKey: apiKey,
        });
        this.model = model;
    }

    async generate(prompt: string): Promise<string> {
        try {
            const completion = await this.client.chat.completions.create({
                messages: [
                    { role: "user", content: prompt }
                ],
                model: this.model,
                temperature: 0,
                max_tokens: 1024,
                stream: false
            });

            return completion.choices[0]?.message?.content || "";
        } catch (error) {
            console.error("Cerebras Provider Error:", error);
            throw error;
        }
    }

    async checkHealth(): Promise<HealthCheckResult> {
        try {
            await this.client.chat.completions.create({
                messages: [{ role: "user", content: "ping" }],
                model: this.model,
                max_tokens: 1,
            });
            return { ok: true };
        } catch (e: unknown) {
            console.error("Cerebras Health Check Failed:", e);
            if (e instanceof Error) {
                if (e.message.includes("402")) {
                    return { ok: false, error: "Sin saldo o plan vencido (402 Billing)" };
                }
                if (e.message.includes("404")) {
                    return { ok: false, error: `Modelo no encontrado o URL incorrecta. Modelo actual: ${this.model}` };
                }
                return { ok: false, error: e.message };
            }
            return { ok: false, error: "Error desconocido" };
        }
    }
}