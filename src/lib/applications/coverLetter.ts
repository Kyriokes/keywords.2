import "server-only";

import prisma from "@/lib/prisma";
import { postToMcp } from "@/lib/ia/client";
import { LIMITS, type ActionResult } from "@/lib/validation";
import { buildCoverLetterPrompt, cleanCoverLetter } from "./prepare";
import { findAiTells } from "./voice";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Genera con la IA gratuita el borrador de la carta de una postulación y lo guarda.
 * Sin `overwrite` no toca una carta que ya existe (puede ser la que el usuario editó o la que se envió).
 */
export async function generateCoverLetterForApplication(
    profileId: string,
    applicationId: string,
    opts: { overwrite?: boolean } = {}
): Promise<ActionResult<{ text: string }>> {
    const application = await prisma.jobApplication.findFirst({
        where: { id: applicationId, profileId },
        select: {
            jobTitle: true,
            company: true,
            jobDescription: true,
            coverLetter: { select: { text: true } },
            cvVariant: { select: { text: true } },
            profile: { select: { user: { select: { name: true } } } },
        },
    });
    if (!application) return { ok: false, code: "NOT_FOUND", message: "La oferta ya no existe." };
    if (application.coverLetter && !opts.overwrite) {
        return { ok: true, data: { text: application.coverLetter.text } };
    }

    const recent = await prisma.coverLetter.count({
        where: { profileId, applicationId: { not: null }, updatedAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (recent >= LIMITS.coverLettersPerDay) {
        return {
            ok: false,
            code: "LIMIT_REACHED",
            message: `Llegaste a ${LIMITS.coverLettersPerDay} cartas generadas en 24 horas. Probá más tarde.`,
        };
    }

    const [activeCv, template] = await Promise.all([
        application.cvVariant
            ? null
            : prisma.cV.findFirst({ where: { profileId, isPrimary: true }, select: { text: true } }),
        prisma.coverLetter.findFirst({
            where: { profileId, applicationId: null },
            orderBy: { updatedAt: "desc" },
            select: { text: true },
        }),
    ]);
    const cvText = application.cvVariant?.text ?? activeCv?.text;
    if (!cvText?.trim()) {
        return { ok: false, code: "NO_CV", message: "Cargá tu CV en Mi perfil para generar la carta." };
    }

    const input = {
        jobTitle: application.jobTitle,
        company: application.company,
        jobDescription: application.jobDescription,
        cvText,
        candidateName: application.profile.user.name,
        template: template?.text,
    };

    let text: string | null = null;
    try {
        const { text: raw } = await postToMcp(buildCoverLetterPrompt(input));
        text = cleanCoverLetter(raw, LIMITS.coverLetter);
    } catch (error) {
        console.error("Cover letter generation failed:", error);
        return { ok: false, code: "AI_SERVICE_UNAVAILABLE", message: "La IA no respondió. Probá de nuevo en un rato." };
    }
    if (!text) {
        return { ok: false, code: "AI_INVALID", message: "La IA devolvió una carta inutilizable. Probá regenerarla." };
    }

    // Si suena a IA se pide una vez más sin esas frases; si no mejora o falla, queda la primera: nunca sin carta
    const tells = findAiTells(text);
    if (tells.length) {
        try {
            const { text: raw } = await postToMcp(buildCoverLetterPrompt({ ...input, avoid: tells }));
            const retry = cleanCoverLetter(raw, LIMITS.coverLetter);
            if (retry !== null && findAiTells(retry).length < tells.length) text = retry;
        } catch (error) {
            console.error("Cover letter retry failed:", error);
        }
    }

    await prisma.coverLetter.upsert({
        where: { applicationId },
        create: { profileId, applicationId, text },
        update: { text },
    });
    return { ok: true, data: { text } };
}
