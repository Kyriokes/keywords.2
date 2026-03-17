import { CohereClient } from "cohere-ai";
import { AiProvider, HealthCheckResult } from "./types";

export class CohereProvider implements AiProvider {
    id = "cohere";
    name = "Cohere (Command R)";
    
    private client: CohereClient;
    private model: string;

    constructor(apiKey: string, model: string = "command-r7b-12-2024") {
        this.client = new CohereClient({
            token: apiKey,
        });
        this.model = model;
    }

    async generate(prompt: string): Promise<string> {
        try {
            const chatResponse = await this.client.chat({
                model: this.model,
                message: prompt,
                temperature: 0,
            });

            return chatResponse.text;
        } catch (error) {
            console.error("Cohere Provider Error:", error);
            throw error;
        }
    }

    async checkHealth(): Promise<HealthCheckResult> {
        try {
            await this.client.chat({
                model: this.model,
                message: "ping",
                maxTokens: 1,
            });
            return { ok: true };
        } catch (e: unknown) {
            console.error("Cohere Health Check Failed:", e);
            return { 
                ok: false, 
                error: e instanceof Error ? e.message : "Error desconocido" 
            };
        }
    }
}