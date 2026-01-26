import { AiProvider } from "./types";
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiProvider implements AiProvider {
    id = "gemini";
    name = "Google Gemini";
    
    private client: GoogleGenerativeAI;
    private model: string;

    constructor(apiKey: string, model: string = "gemini-1.5-flash") {
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
}
