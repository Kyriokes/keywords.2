import "server-only";

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SearchRunResult } from "./run";
import type { IngestedOfferInput, RunTrigger } from "./stats";

/** Las ofertas que no se vuelven a ver en este tiempo se borran: alcanza para comparar 90 días. */
export const OFFER_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Crea las ofertas que no existen (un createMany con skipDuplicates) y actualiza las conocidas. Primero un updateMany
 * para las IN_ACCOUNT, que solo renuevan lastSeenAt y timesSeen; después un updateMany por cada grupo
 * (decision, reason, score), en el orden en que aparece cada grupo. firstSeenAt y roleName no se tocan. Sin ofertas no consulta nada.
 */
export async function upsertIngestedOffers(
    profileId: string,
    offers: IngestedOfferInput[],
    now: Date = new Date()
): Promise<{ created: number; updated: number }> {
    if (offers.length === 0) return { created: 0, updated: 0 };

    const existing = await prisma.ingestedOffer.findMany({
        where: { profileId, externalId: { in: offers.map((offer) => offer.externalId) } },
        select: { externalId: true },
    });
    const known = new Set(existing.map((offer) => offer.externalId));

    const fresh = offers.filter((offer) => !known.has(offer.externalId));
    let created = 0;
    if (fresh.length) {
        const result = await prisma.ingestedOffer.createMany({
            data: fresh.map((offer) => ({ ...offer, profileId, firstSeenAt: now, lastSeenAt: now })),
            skipDuplicates: true,
        });
        created = result.count;
    }

    const seenAgain = { lastSeenAt: now, timesSeen: { increment: 1 } };
    const repeated = offers.filter((offer) => known.has(offer.externalId));

    // Las que ya estaban en la cuenta no se vuelven a evaluar: conservan la decisión que tuvieron
    const inAccount = repeated.filter((offer) => offer.decision === "IN_ACCOUNT").map((offer) => offer.externalId);
    if (inAccount.length) {
        await prisma.ingestedOffer.updateMany({ where: { profileId, externalId: { in: inAccount } }, data: seenAgain });
    }

    // El resto puede cambiar si cambiaron los filtros o los puestos: una consulta por cada resultado distinto
    const groups = new Map<string, { decision: string; reason: string | null; score: number | null; ids: string[] }>();
    for (const offer of repeated) {
        if (offer.decision === "IN_ACCOUNT") continue;
        const key = JSON.stringify([offer.decision, offer.reason, offer.score]);
        const group = groups.get(key) ?? { decision: offer.decision, reason: offer.reason, score: offer.score, ids: [] };
        group.ids.push(offer.externalId);
        groups.set(key, group);
    }
    for (const { decision, reason, score, ids } of groups.values()) {
        await prisma.ingestedOffer.updateMany({
            where: { profileId, externalId: { in: ids } },
            data: { ...seenAgain, decision, reason, score },
        });
    }

    return { created, updated: repeated.length };
}

/**
 * Guarda la corrida (startedAt lo pone la base), registra sus ofertas y borra las que no se vieron en OFFER_RETENTION_DAYS.
 * `now` solo se usa para las fechas de las ofertas y el corte del borrado.
 */
export async function saveSearchRun(
    profileId: string,
    trigger: RunTrigger,
    result: SearchRunResult,
    durationMs: number,
    now: Date = new Date()
): Promise<void> {
    await prisma.searchRun.create({
        data: {
            profileId,
            trigger,
            durationMs,
            fetched: result.fetched,
            fresh: result.fresh,
            matchedRole: result.matchedRole,
            filtered: result.filtered,
            created: result.created,
            deferred: result.deferred,
            bySource: result.bySource as unknown as Prisma.InputJsonValue,
            errors: result.errors,
        },
    });
    await upsertIngestedOffers(profileId, result.offers, now);
    await prisma.ingestedOffer.deleteMany({
        where: { profileId, lastSeenAt: { lt: new Date(now.getTime() - OFFER_RETENTION_DAYS * DAY_MS) } },
    });
}
