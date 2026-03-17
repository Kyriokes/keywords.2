import { AiProvider, HealthCheckResult } from "./types";
import OpenAI from "openai";

export class DeepSeekProvider implements AiProvider {
    id = "deepseek";
    name = "DeepSeek V3";
    
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = "deepseek-chat") {
        this.client = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: apiKey
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
            console.error("DeepSeek Provider Error:", error);
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
            console.error("DeepSeek Health Check Failed:", e);
            if (e instanceof Error) {
                if (e.message.includes("402") || e.message.includes("Insufficient Balance")) {
                    return { ok: false, error: "Saldo insuficiente (Billing)" };
                }
                return { ok: false, error: e.message };
            }
            return { ok: false, error: "Error desconocido" };
        }
    }
}