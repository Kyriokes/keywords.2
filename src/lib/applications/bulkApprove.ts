import "server-only";

import prisma from "@/lib/prisma";

/**
 * Aprueba de una vez las ofertas por aprobar (READY) del perfil cuyo match con el CV llega al mínimo.
 * Devuelve las que aprobó, de mayor a menor match.
 */
export async function approveReadyByScore(profileId: string, minScore: number): Promise<string[]> {
    const offers = await prisma.jobApplication.findMany({
        where: { profileId, status: "READY", score: { gte: minScore } },
        orderBy: { score: "desc" },
        select: { id: true },
    });
    const ids = offers.map((offer) => offer.id);
    if (ids.length === 0) return [];

    // Se vuelve a filtrar por estado: si alguna cambió mientras tanto, no se toca
    await prisma.jobApplication.updateMany({
        where: { id: { in: ids }, profileId, status: "READY" },
        data: { status: "APPROVED" },
    });
    return ids;
}
