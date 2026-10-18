import "server-only";

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isProviderId, type ProviderId } from "@/lib/ia/providers/ids";
import { detectKeywords, resolveTerms } from "@/lib/keywords/dictionary";
import { classifyJobTitle } from "@/lib/positions/dictionary";
import { computeMatchScore } from "./prepare";
import { LIMITS, createApplicationSchema, firstIssueMessage, type ActionResult } from "@/lib/validation";

export const applicationInclude = {
    keywords: {
        include: { keyword: true },
    },
    position: true,
    canonicalPosition: true,
} satisfies Prisma.JobApplicationInclude;

export type ApplicationWithRelations = Prisma.JobApplicationGetPayload<{ include: typeof applicationInclude }>;

/**
 * Crea una postulación en el perfil indicado. La comparten la carga desde la app y el agente:
 * valida, respeta el máximo por perfil, evita links repetidos y clasifica título y keywords.
 */
export async function createApplicationForProfile(
    profileId: string,
    data: unknown
): Promise<ActionResult<{ application: ApplicationWithRelations; provider?: ProviderId }>> {
    const parsed = createApplicationSchema.safeParse(data);
    if (!parsed.success) {
        return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) };
    }
    const input = parsed.data;
    const provider = isProviderId(input.provider) ? input.provider : undefined;

    const total = await prisma.jobApplication.count({
        where: { profileId },
    });
    if (total >= LIMITS.applicationsPerProfile) {
        return {
            ok: false,
            code: "LIMIT_REACHED",
            message: `Alcanzaste el máximo de ${LIMITS.applicationsPerProfile} postulaciones.`,
        };
    }

    // Check for duplicates by link
    if (input.link) {
        const exists = await prisma.jobApplication.findFirst({
            where: {
                profileId,
                link: { equals: input.link, mode: "insensitive" },
            },
            select: { id: true },
        });
        if (exists) {
            return { ok: false, code: "DUPLICATE_LINK", message: "Esta oferta ya existe (link duplicado)." };
        }
    }

    // Find related Position if exists
    let positionId: string | undefined;
    if (input.positionTitle) {
        const position = await prisma.position.findFirst({
            where: {
                profileId,
                title: input.positionTitle,
            },
        });
        positionId = position?.id;
    }

    // Find active CV
    const activeCv = await prisma.cV.findFirst({
        where: {
            profileId,
            isPrimary: true,
        },
    });

    // Keywords: los términos recibidos pasan por el diccionario. Si la lista no fue revisada
    // (postulaciones importadas) se suman los que el diccionario detecta en la descripción;
    // si fue revisada no, porque volvería a agregar lo que el usuario quitó.
    const detected = input.reviewed ? [] : await detectKeywords(input.jobDescription);
    const keywordIds = Array.from(
        new Set([...(await resolveTerms(input.detectedWords)), ...detected.map((k) => k.id)])
    ).slice(0, LIMITS.applicationKeywords);

    const classified = await classifyJobTitle(input.jobTitle);

    // Si no viene un score de afuera, se calcula: keywords de la oferta que ya están en el CV activo
    const cvKeywords = activeCv
        ? await prisma.cVKeyword.findMany({ where: { cvId: activeCv.id }, select: { keywordId: true } })
        : [];
    const score = input.score ?? computeMatchScore(keywordIds, cvKeywords.map((k) => k.keywordId)) ?? undefined;

    const application = await prisma.jobApplication.create({
        data: {
            profileId,
            jobTitle: input.jobTitle,
            jobDescription: input.jobDescription,
            link: input.link,
            provider,
            // Sin valor, la base pone la fecha de hoy y el estado inicial
            date: input.date,
            status: input.status,

            company: input.company,
            source: input.source,
            applyUrl: input.applyUrl,
            applyMode: input.applyMode,
            externalId: input.externalId,
            score,
            notes: input.notes,

            // Relations
            positionId,
            originalPositionTitle: input.positionTitle, // Snapshot History
            canonicalPositionId: classified.roleId,
            seniority: classified.seniority,
            cvId: activeCv?.id,

            // Keywords Relation
            keywords: {
                create: keywordIds.map((keywordId) => ({ keywordId })),
            },
        },
        include: applicationInclude,
    });

    return { ok: true, data: { application, provider } };
}
