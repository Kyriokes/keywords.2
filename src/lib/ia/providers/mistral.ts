import { Mistral } from '@mistralai/mistralai';
import { AiProvider, HealthCheckResult } from "./types";

export class MistralProvider implements AiProvider {
    id = "mistral";
    name = "Mistral AI";
    
    private client: Mistral;
    private model: string;

    constructor(apiKey: string, model: string = "ministral-14b-latest") {
        this.client = new Mistral({
            apiKey: apiKey,
        });
        this.model = model;
    }

    async generate(prompt: string): Promise<string> {
        try {
            const chatResponse = await this.client.chat.complete({
                model: this.model,
                messages: [
                    { role: "user", content: prompt }
                ],
                temperature: 0,
                maxTokens: 1024,
            });

            // Acceso al contenido de la respuesta
            const content = chatResponse.choices?.[0]?.message?.content;
            
            // Mistral puede devolver contenido como string o array de fragmentos
            if (typeof content === 'string') {
                return content;
            }
            return "";
        } catch (error) {
            console.error("Mistral Provider Error:", error);
            throw error;
        }
    }

    async checkHealth(): Promise<HealthCheckResult> {
        try {
            // Un "ping" rápido para verificar la API Key y conexión
            await this.client.chat.complete({
                model: this.model,
                messages: [{ role: "user", content: "ping" }],
                maxTokens: 1,
            });
            return { ok: true };
        } catch (e: unknown) {
            console.error("Mistral Health Check Failed:", e);
            return { 
                ok: false, 
                error: e instanceof Error ? e.message : "Error desconocido" 
            };
        }
    }
}