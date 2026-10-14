import { AiProvider, HealthCheckResult } from "./types";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

export class OpenRouterProvider implements AiProvider {
    id = "openrouter";
    name = "OpenRouter (Nemotron)";
    
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = "nvidia/nemotron-3-super-120b-a12b:free") {
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: apiKey,
            defaultHeaders: {
                "HTTP-Referer": process.env.AUTH_URL || "http://localhost:3000",
                "X-Title": "KeyWords V2",
            }
        });
        // Nemotron 3 Super (versión gratuita) como modelo por defecto
        this.model = model;
    }

    async generate(prompt: string): Promise<string> {
        try {
            // Nemotron razona por defecto y gasta los max_tokens pensando: la respuesta llega vacía.
            // `reasoning` es un parámetro propio de OpenRouter, por eso no está en los tipos del SDK.
            const params: ChatCompletionCreateParamsNonStreaming & { reasoning: { enabled: boolean } } = {
                messages: [
                    { role: "user", content: prompt }
                ],
                model: this.model,
                temperature: 0,
                max_tokens: 1024,
                stream: false,
                reasoning: { enabled: false }
            };
            const completion = await this.client.chat.completions.create(params);

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