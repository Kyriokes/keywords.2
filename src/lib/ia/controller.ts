import { postToMcp } from "./client";
import tryParseJsonFromText from "./helpers/tryParseJsonFromText";
import validateAiResponse from "./helpers/validateAiResponse";
import localFallback from "./helpers/localFallback";
import buildPrompt from "./helpers/buildPrompt";
import type { AiResponse, AiKeyword } from "./types";

export async function processJobApplication(
    jobTitle: string,
    jobDescription: string,
    opts?: { mcpUrl?: string; model?: string; timeoutMs?: number }
): Promise<AiResponse> {
    const combined = `${jobTitle}\n\n${jobDescription}`;
    const prompt = buildPrompt(combined);

    try {
        const raw = await postToMcp(prompt, {
            url: opts?.mcpUrl,
            model: opts?.model,
            timeoutMs: opts?.timeoutMs,
        });
        const parsed = tryParseJsonFromText(raw);
        if (!validateAiResponse(parsed)) throw new Error("schema mismatch");
        return parsed;
    } catch (err) {
        console.warn(
            "AI controller: MCP call failed or response invalid, using fallback:",
            err
        );
        return localFallback(combined);
    }
}
