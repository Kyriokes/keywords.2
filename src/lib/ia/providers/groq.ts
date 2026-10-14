import { AiProvider, HealthCheckResult } from "./types";
import Groq from "groq-sdk";

export class GroqProvider implements AiProvider {
    id = "groq";
    name = "Groq (Qwen 3.8)";
    
    private client: Groq;
    private model: string;

    constructor(apiKey: string, model: string = "qwen/qwen3.8-27b") {
        this.client = new Groq({
            apiKey: apiKey,
        });
        this.model = model;
    }

    async generate(prompt: string): Promise<string> {
        try {
            const chatCompletion = await this.client.chat.completions.create({
                messages: [
                    { role: "user", content: prompt }
                ],
                model: this.model,
                temperature: 0,
                max_tokens: 1024,
                stream: false
            });

            return chatCompletion.choices[0]?.message?.content || "";
        } catch (error) {
            console.error("Groq Provider Error:", error);
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
            console.error("Groq Health Check Failed:", e);
            if (e instanceof Error) {
                return { ok: false, error: e.message };
            }
            return { ok: false, error: "Error desconocido" };
        }
    }
}