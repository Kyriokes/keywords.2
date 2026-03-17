import { AiProvider, HealthCheckResult } from "./types";
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiProvider implements AiProvider {
    id = "gemini";
    name = "Google Gemini";
    
    private client: GoogleGenerativeAI;
    private model: string;

    constructor(apiKey: string, model: string = "gemini-2.5-flash") {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = model;
    }

    async generate(prompt: string): Promise<string> {
        try {
            const model = this.client.getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini Provider Error:", error);
            throw error;
        }
    }

    async checkHealth(): Promise<HealthCheckResult> {
        try {
            const model = this.client.getGenerativeModel({ model: this.model });
            await model.generateContent("ping");
            return { ok: true };
        } catch (e: unknown) {
            console.error("Gemini Health Check Failed:", e);
            if (e instanceof Error) {
                if (e.message.includes("404") || e.message.includes("not found")) {
                    return { ok: false, error: "Modelo no encontrado o API no habilitada (404)" };
                }
                return { ok: false, error: e.message };
            }
            return { ok: false, error: "Error desconocido" };
        }
    }
}