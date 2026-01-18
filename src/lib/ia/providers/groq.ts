import { AiProvider } from "./types";
import Groq from "groq-sdk";

export class GroqProvider implements AiProvider {
    id = "groq";
    name = "Groq (Llama 3)";
    
    private client: Groq;
    private model: string;

    constructor(apiKey: string, model: string = "llama-3.3-70b-versatile") {
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
}
