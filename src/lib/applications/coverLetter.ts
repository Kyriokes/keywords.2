import "server-only";

import prisma from "@/lib/prisma";
import { postToMcp } from "@/lib/ia/client";
import { detectKeywords } from "@/lib/keywords/dictionary";
import { LIMITS, type ActionResult } from "@/lib/validation";
import { detectLanguage, type LetterLanguage } from "./language";
import { buildCoverLetterPrompt, cleanCoverLetter, pickTemplate } from "./prepare";
import { findAiTells } from "./voice";

const DAY_MS = 24 * 60 * 60 * 1000;
// Tope de tecnologías faltantes que se nombran en el pedido: alcanza con las principales
const MAX_MISSING_SKILLS = 10;

interface SkillContext {
    /** Tecnologías que el candidato puede nombrar: las del CV, la carta modelo y el nombre de la empresa. */
    allowed: Set<string>;
    /** Las que pide la oferta y no están en el CV. */
    missing: string[];
}

/** Tecnologías del diccionario en la oferta y en lo que respalda al candidato; null si el diccionario no responde. */
async function skillContext(jobDescription: string, own: string): Promise<SkillContext | null> {
    try {
        const [offer, mine] = await Promise.all([detectKeywords(jobDescription), detectKeywords(own)]);
        const allowed = new Set(mine.map((keyword) => keyword.id));
        const missing = offer.filter((keyword) => !allowed.has(keyword.id)).map((keyword) => keyword.name);
        return { allowed, missing: missing.slice(0, MAX_MISSING_SKILLS) };
    } catch (error) {
        console.error("Cover letter skills not checked:", error);
        return null;
    }
}

interface LetterReview {
    tells: string[];
    wrongLanguage: boolean;
    unsupported: string[];
}

/** Lo que la carta hace mal según reglas que no dependen del modelo. */
async function reviewLetter(text: string, language: LetterLanguage, skills: SkillContext | null): Promise<LetterReview> {
    let unsupported: string[] = [];
    if (skills) {
        try {
            unsupported = (await detectKeywords(text)).filter((keyword) => !skills.allowed.has(keyword.id)).map((keyword) => keyword.name);
        } catch (error) {
            console.error("Cover letter skills not checked:", error);
        }
    }
    return { tells: findAiTells(text), wrongLanguage: detectLanguage(text) !== language, unsupported };
}

const hasProblems = (review: LetterReview) => review.wrongLanguage || review.unsupported.length > 0 || review.tells.length > 0;

/** Si `a` es mejor que `b`: pesa más el idioma, después las tecnologías inventadas y por último las muletillas. */
function isBetter(a: LetterReview, b: LetterReview): boolean {
    const rank = (review: LetterReview) => [review.wrongLanguage ? 1 : 0, review.unsupported.length, review.tells.length];
    const [x, y] = [rank(a), rank(b)];
    const differs = x.findIndex((value, index) => value !== y[index]);
    return differs >= 0 && x[differs] < y[differs];
}

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

    const [activeCv, templates] = await Promise.all([
        application.cvVariant
            ? null
            : prisma.cV.findFirst({ where: { profileId, isPrimary: true }, select: { text: true } }),
        prisma.coverLetter.findMany({
            where: { profileId, applicationId: null },
            orderBy: { updatedAt: "desc" },
            take: 10,
            select: { text: true },
        }),
    ]);
    const cvText = application.cvVariant?.text ?? activeCv?.text;
    if (!cvText?.trim()) {
        return { ok: false, code: "NO_CV", message: "Cargá tu CV en Mi perfil para generar la carta." };
    }

    const language = detectLanguage(`${application.jobTitle}\n${application.jobDescription}`);
    const template = pickTemplate(templates, language);
    const skills = await skillContext(
        application.jobDescription,
        [cvText, template, application.company].filter(Boolean).join("\n")
    );

    const input = {
        jobTitle: application.jobTitle,
        company: application.company,
        jobDescription: application.jobDescription,
        cvText,
        candidateName: application.profile.user.name,
        template,
        language,
        missingSkills: skills?.missing,
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

    // Si salió en otro idioma, nombra tecnologías que no están en el CV o suena a IA, se pide una vez más
    // señalando qué corregir; si no mejora o falla, queda la primera: nunca sin carta
    const review = await reviewLetter(text, language, skills);
    if (hasProblems(review)) {
        try {
            const { text: raw } = await postToMcp(
                buildCoverLetterPrompt({ ...input, avoid: review.tells, unsupported: review.unsupported, wrongLanguage: review.wrongLanguage })
            );
            const retry = cleanCoverLetter(raw, LIMITS.coverLetter);
            if (retry !== null && isBetter(await reviewLetter(retry, language, skills), review)) text = retry;
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
