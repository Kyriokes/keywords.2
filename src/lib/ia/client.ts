import type { McpOptions } from "./types";

const DEFAULT_URL = "http://127.0.0.1:11434/api/generate";

export async function postToMcp(
    prompt: string,
    opts?: McpOptions
): Promise<string> {
    const url = opts?.url || DEFAULT_URL;
    const model = opts?.model || "llama-3.1";

    const body = {
        model,
        prompt,
        temperature: 0,
        max_tokens: 800,
        stream: false
    } as any;

    const controller = new AbortController();
    const timeout = opts?.timeoutMs ?? 15000;
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `MCP responded ${res.status}: ${res.statusText} - ${text}`
            );
        }

        const json = await res.json();
        // Ollama devuelve la respuesta en .response
        return json.response || "";
    } finally {
        clearTimeout(id);
    }
}
