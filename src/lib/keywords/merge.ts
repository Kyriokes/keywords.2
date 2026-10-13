// Sin "server-only" ni alias de rutas: también lo usan los scripts de `prisma/dictionary`.
import type { Prisma } from "@prisma/client";
import { aliasKey } from "./core";

/**
 * Fusiona una keyword en otra: mueve sus vínculos con postulaciones y CVs, sus alias,
 * registra su nombre como alias del destino y la borra. Debe correr dentro de una transacción.
 */
export async function mergeKeywordInto(tx: Prisma.TransactionClient, sourceId: string, targetId: string) {
    if (sourceId === targetId) return;

    const source = await tx.keyword.findUnique({
        where: { id: sourceId },
        select: { displayName: true, canonicalText: true },
    });
    if (!source) return;

    const applicationLinks = await tx.jobApplicationKeyword.findMany({
        where: { keywordId: sourceId },
        select: { jobApplicationId: true },
    });
    await tx.jobApplicationKeyword.createMany({
        data: applicationLinks.map((link) => ({ jobApplicationId: link.jobApplicationId, keywordId: targetId })),
        skipDuplicates: true,
    });

    const cvLinks = await tx.cVKeyword.findMany({
        where: { keywordId: sourceId },
        select: { cvId: true },
    });
    await tx.cVKeyword.createMany({
        data: cvLinks.map((link) => ({ cvId: link.cvId, keywordId: targetId })),
        skipDuplicates: true,
    });

    await tx.keywordAlias.updateMany({
        where: { keywordId: sourceId },
        data: { keywordId: targetId },
    });

    const ownKey = aliasKey(source.displayName || source.canonicalText);
    if (ownKey) {
        await tx.keywordAlias.createMany({
            data: [{ aliasText: ownKey, keywordId: targetId }],
            skipDuplicates: true,
        });
    }

    // Los vínculos viejos de la keyword de origen se borran en cascada
    await tx.keyword.delete({ where: { id: sourceId } });
}
