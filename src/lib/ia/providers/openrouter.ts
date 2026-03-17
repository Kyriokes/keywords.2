import { AiProvider, HealthCheckResult } from "./types";
import OpenAI from "openai";

export class OpenRouterProvider implements AiProvider {
    id = "openrouter";
    name = "OpenRouter (Nemotron)";
    
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = "nvidia/llama-3.1-nemotron-70b-instruct") {
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: apiKey,
            defaultHeaders: {
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "KeyWords V2",
            }
        });
        // Usamos Nemotron 70b Instruct como modelo por defecto
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
            console.error("OpenRouter Provider Error:", error);
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
            console.error("OpenRouter Health Check Failed:", e);
            if (e instanceof Error) {
                return { ok: false, error: e.message };
            }
            return { ok: false, error: "Error desconocido" };
        }
    }
}