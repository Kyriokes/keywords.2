'use server';

import { postToMcp } from "./client";
import tryParseJsonFromText from "./helpers/tryParseJsonFromText";
import validateAiResponse from "./helpers/validateAiResponse";
import { buildPromptManual, buildPromptAuto } from "./helpers/buildPrompt";
import type { AiResponse } from "./types";
import { auth } from "@/auth";
import { providerManager } from "./providerManager";

export async function processJobApplication(
    jobTitle: string,
    jobDescription: string,
    opts?: { 
        mcpUrl?: string; 
        model?: string; 
        timeoutMs?: number; 
        autoSelect?: boolean; 
        candidatePositions?: string[];
        excludeProviders?: string[];
    }
): Promise<AiResponse> {
    const combined = `${jobTitle}\n\n${jobDescription}`;
    const prompt = opts?.autoSelect
        ? buildPromptAuto(combined)
        : buildPromptManual(combined);

    try {
        const { text: raw, providerId } = await postToMcp(prompt, {
            url: opts?.mcpUrl,
            model: opts?.model,
            timeoutMs: opts?.timeoutMs,
            excludeProviders: opts?.excludeProviders
        });
        const parsed = tryParseJsonFromText(raw);
        if (!validateAiResponse(parsed)) throw new Error("schema mismatch");
        
        // Attach provider info
        parsed.provider = providerId;
        
        // Persistir estadística "generated"
        try {
            const session = await auth();
            if (session?.user?.id) {
                // Obtener profileId real desde la BD
                const prisma = (await import("@/lib/prisma")).default;
                const profile = await prisma.profile.findUnique({
                    where: { userId: session.user.id },
                    select: { id: true }
                });

                if (profile) {
                    // No await para no bloquear la respuesta al usuario
                    providerManager.persistUserStats(profile.id, providerId, 'generated').catch(console.error);
                }
            }
        } catch (e) {
            console.error("Error logging stats:", e);
        }

        return parsed;
    } catch (err) {
        console.error("AI controller: Error connecting to AI service:", err);
        // Re-lanzamos el error para que la UI lo maneje y muestre la alerta al usuario.
        // Ya no usamos el fallback silencioso.
        throw new Error("AI_SERVICE_UNAVAILABLE");
    }
}
