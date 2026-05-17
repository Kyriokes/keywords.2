'use server';

import { postToMcp } from "./client";
import tryParseJsonFromText from "./helpers/tryParseJsonFromText";
import validateAiResponse from "./helpers/validateAiResponse";
import { buildPromptManual, buildPromptAuto } from "./helpers/buildPrompt";
import type { AiResponse } from "./types";
import { auth } from "@/auth";
import { providerManager } from "./providerManager";
import { checkAndConsumeQuota } from "@/lib/quota.service";

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

    // ─── 1. AUTENTICACIÓN ────────────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("UNAUTHENTICATED");
    }

    // ─── 2. VERIFICAR Y CONSUMIR QUOTA ──────────────────────────────────────
    const quotaResult = await checkAndConsumeQuota(session.user.id);

    if (!quotaResult.allowed) {
        if (quotaResult.reason === "QUOTA_EXCEEDED") {
            // Lanzamos un error serializable con los datos necesarios para la UI
            throw new Error(
                `QUOTA_EXCEEDED:${quotaResult.usedToday}:${quotaResult.limit}:${quotaResult.resetsAt.toISOString()}`
            );
        }
        throw new Error("UNAUTHENTICATED");
    }

    // ─── 3. LLAMADA A LA IA ─────────────────────────────────────────────────
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
        
        parsed.provider = providerId;

        // ─── 4. PERSISTIR STATS (fire-and-forget) ───────────────────────────
        try {
            const prisma = (await import("@/lib/prisma")).default;
            const profile = await prisma.profile.findUnique({
                where: { userId: session.user.id },
                select: { id: true }
            });
            if (profile) {
                providerManager.persistUserStats(profile.id, providerId, 'generated').catch(console.error);
            }
        } catch (e) {
            console.error("Error logging stats:", e);
        }

        return parsed;

    } catch (err) {
        // Si el error ya es nuestro (QUOTA_EXCEEDED, UNAUTHENTICATED), lo re-lanzamos sin envolver
        if (err instanceof Error && (
            err.message.startsWith("QUOTA_EXCEEDED") ||
            err.message === "UNAUTHENTICATED"
        )) {
            throw err;
        }

        console.error("AI controller: Error connecting to AI service:", err);
        throw new Error("AI_SERVICE_UNAVAILABLE");
    }
}
