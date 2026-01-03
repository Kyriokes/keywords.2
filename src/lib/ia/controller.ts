import { postToMcp } from "./client";
import tryParseJsonFromText from "./helpers/tryParseJsonFromText";
import validateAiResponse from "./helpers/validateAiResponse";
import localFallback, { localFallbackAuto } from "./helpers/localFallback";
import { buildPromptManual, buildPromptAuto } from "./helpers/buildPrompt";
import type { AiResponse } from "./types";

export async function processJobApplication(
    jobTitle: string,
    jobDescription: string,
    opts?: { mcpUrl?: string; model?: string; timeoutMs?: number; autoSelect?: boolean; candidatePositions?: string[] }
): Promise<AiResponse> {
    const combined = `${jobTitle}\n\n${jobDescription}`;
    const prompt = opts?.autoSelect
        ? buildPromptAuto(combined, opts?.candidatePositions || [])
        : buildPromptManual(combined);

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
        console.error("AI controller: Error connecting to AI service:", err);
        // Re-lanzamos el error para que la UI lo maneje y muestre la alerta al usuario.
        // Ya no usamos el fallback silencioso.
        throw new Error("AI_SERVICE_UNAVAILABLE");
    }
}
