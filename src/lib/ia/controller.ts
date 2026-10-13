'use server';

import { postToMcp } from "./client";
import tryParseJsonFromText from "./helpers/tryParseJsonFromText";
import validateAiResponse, { limitAiResponse } from "./helpers/validateAiResponse";
import { buildPromptManual, buildPromptAuto } from "./helpers/buildPrompt";
import type { ProcessJobResult } from "./types";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { providerManager } from "./providerManager";
import { isProviderId } from "./providers/ids";
import { standardizeOfferKeywords } from "@/lib/keywords/dictionary";
import { checkAndConsumeQuota, refundQuota } from "@/lib/quota.service";
import { LIMITS } from "@/lib/validation";

export async function processJobApplication(
    jobTitle: string,
    jobDescription: string,
    opts?: {
        autoSelect?: boolean;
        excludeProviders?: string[];
    }
): Promise<ProcessJobResult> {

    // ─── 1. AUTENTICACIÓN ────────────────────────────────────────────────────
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
        return { ok: false, code: "UNAUTHENTICATED" };
    }

    // ─── 2. VALIDAR ENTRADA (antes de gastar quota o tokens de IA) ──────────
    if (
        typeof jobTitle !== "string" ||
        typeof jobDescription !== "string" ||
        !jobDescription.trim() ||
        jobTitle.length > LIMITS.title ||
        jobDescription.length > LIMITS.jobDescription
    ) {
        return { ok: false, code: "INVALID_INPUT" };
    }

    const excludeProviders = Array.isArray(opts?.excludeProviders)
        ? opts.excludeProviders.filter(isProviderId)
        : [];

    // ─── 3. VERIFICAR Y CONSUMIR QUOTA ──────────────────────────────────────
    const quotaResult = await checkAndConsumeQuota(userId);

    if (!quotaResult.allowed) {
        if (quotaResult.reason === "QUOTA_EXCEEDED") {
            return {
                ok: false,
                code: "QUOTA_EXCEEDED",
                usedToday: quotaResult.usedToday,
                limit: quotaResult.limit,
                resetsAt: quotaResult.resetsAt,
            };
        }
        return { ok: false, code: "UNAUTHENTICATED" };
    }

    // ─── 4. LLAMADA A LA IA ─────────────────────────────────────────────────
    const combined = `${jobTitle}\n\n${jobDescription}`;
    const prompt = opts?.autoSelect
        ? buildPromptAuto(combined)
        : buildPromptManual(combined);

    try {
        const { text: raw, providerId } = await postToMcp(prompt, { excludeProviders });

        const parsed = tryParseJsonFromText(raw);
        if (!validateAiResponse(parsed)) throw new Error("schema mismatch");

        const data = limitAiResponse(parsed);
        data.provider = providerId;

        // ─── 5. ESTANDARIZAR CONTRA EL DICCIONARIO ──────────────────────────
        // Si falla, el usuario igual recibe lo que devolvió la IA; al guardar se vuelve a intentar.
        try {
            data.palabrasClave = await standardizeOfferKeywords(
                data.palabrasClave,
                jobDescription,
                LIMITS.applicationKeywords
            );
        } catch (e) {
            console.error("Error standardizing keywords:", e);
        }

        // ─── 6. PERSISTIR STATS ─────────────────────────────────────────────
        // Se espera a que termine: el feedback posterior solo cuenta contra generaciones registradas.
        try {
            const profile = await prisma.profile.findUnique({
                where: { userId },
                select: { id: true }
            });
            if (profile) {
                await providerManager.persistGeneration(profile.id, providerId);
            }
        } catch (e) {
            console.error("Error logging stats:", e);
        }

        return { ok: true, data };

    } catch (err) {
        console.error("AI controller: Error connecting to AI service:", err);

        // El usuario no recibió nada: se le devuelve el análisis descontado
        if (quotaResult.consumed) {
            await refundQuota(userId).catch((e) => console.error("Error refunding quota:", e));
        }
        return { ok: false, code: "AI_SERVICE_UNAVAILABLE" };
    }
}
