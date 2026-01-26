import { AiProvider } from "./types";
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
}
