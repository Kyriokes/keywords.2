import { AiProvider } from "./types";

export class OllamaProvider implements AiProvider {
    id = "ollama";
    name = "Ollama (Local)";
    
    private url: string;
    private model: string;

    constructor(url: string = "http://127.0.0.1:11434/api/generate", model: string = "llama3.1") {
        this.url = url;
        this.model = model;
    }

    async generate(prompt: string): Promise<string> {
        const body = {
            model: this.model,
            prompt,
            temperature: 0,
            max_tokens: 800,
            stream: false
        };

        const controller = new AbortController();
        const timeout = 30000; // 30s timeout for local
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(this.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`Ollama Error ${res.status}: ${text}`);
            }

            const json = await res.json();
            return json.response || "";
        } finally {
            clearTimeout(id);
        }
    }
}
