import "server-only";

import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export type QuotaCheckResult =
    | { allowed: true; consumed: boolean }
    | {
          allowed: false;
          reason: "QUOTA_EXCEEDED";
          usedToday: number;
          limit: number;
          resetsAt: Date;
      }
    | { allowed: false; reason: "USER_NOT_FOUND" };

/**
 * Verifica si el usuario puede hacer un análisis y lo consume atómicamente.
 * - ADMIN: siempre permitido, no consume quota.
 * - HUNTER/otros: máximo `dailyAnalysesLimit` por día calendario (UTC-3 Argentina).
 *
 * @param userId ID del usuario (de la sesión)
 */
export async function checkAndConsumeQuota(
    userId: string,
): Promise<QuotaCheckResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            role: true,
            dailyAnalysesLimit: true,
        },
    });

    if (!user) {
        return { allowed: false, reason: "USER_NOT_FOUND" };
    }

    // ADMIN no tiene límite
    if (user.role === UserRole.ADMIN) {
        return { allowed: true, consumed: false };
    }

    const now = new Date();
    const startOfToday = getStartOfDayAR(now);
    const limit = user.dailyAnalysesLimit;

    // Cada intento es un único UPDATE condicional: la base decide si hay cupo,
    // así dos requests simultáneos no pueden pasar con el mismo valor del contador.
    if (limit > 0) {
        // Primer análisis del día (o de la historia): reinicia el contador en 1
        const firstOfDay = await prisma.user.updateMany({
            where: {
                id: userId,
                OR: [
                    { dailyAnalysesDate: null },
                    { dailyAnalysesDate: { lt: startOfToday } },
                ],
            },
            data: { dailyAnalysesUsed: 1, dailyAnalysesDate: now },
        });
        if (firstOfDay.count === 1) {
            return { allowed: true, consumed: true };
        }

        // Mismo día: incrementa solo si todavía queda cupo
        const sameDay = await prisma.user.updateMany({
            where: {
                id: userId,
                dailyAnalysesDate: { gte: startOfToday },
                dailyAnalysesUsed: { lt: limit },
            },
            data: { dailyAnalysesUsed: { increment: 1 }, dailyAnalysesDate: now },
        });
        if (sameDay.count === 1) {
            return { allowed: true, consumed: true };
        }
    }

    const status = await getQuotaStatus(userId);
    return {
        allowed: false,
        reason: "QUOTA_EXCEEDED",
        usedToday: status?.used ?? limit,
        limit,
        resetsAt: getNextMidnightAR(now),
    };
}

/**
 * Devuelve un análisis consumido (por ejemplo, si la IA falló y el usuario no recibió nada).
 */
export async function refundQuota(userId: string): Promise<void> {
    await prisma.user.updateMany({
        where: { id: userId, dailyAnalysesUsed: { gt: 0 } },
        data: { dailyAnalysesUsed: { decrement: 1 } },
    });
}

/**
 * Devuelve el estado actual de quota sin consumirla (para mostrar en UI).
 */
export async function getQuotaStatus(userId: string): Promise<{
    used: number;
    limit: number;
    isAdmin: boolean;
    resetsAt: Date;
} | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            role: true,
            dailyAnalysesUsed: true,
            dailyAnalysesLimit: true,
            dailyAnalysesDate: true,
        },
    });

    if (!user) return null;

    const now = new Date();
    const isNewDay =
        !user.dailyAnalysesDate || user.dailyAnalysesDate < getStartOfDayAR(now);
    const used = isNewDay ? 0 : user.dailyAnalysesUsed;

    return {
        used,
        limit: user.dailyAnalysesLimit,
        isAdmin: user.role === UserRole.ADMIN,
        resetsAt: getNextMidnightAR(now),
    };
}

// ─── Helpers de Timezone ────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Devuelve la medianoche con la que empezó el día actual en Argentina, como Date UTC.
 * Argentina es UTC-3 (sin DST).
 */
function getStartOfDayAR(now: Date): Date {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value) - 1;
    const day = Number(parts.find((p) => p.type === "day")?.value);

    // Medianoche en AR = 03:00 UTC del mismo día calendario (AR = UTC-3)
    return new Date(Date.UTC(year, month, day, 3, 0, 0));
}

/**
 * Devuelve la próxima medianoche en Argentina como Date UTC.
 */
function getNextMidnightAR(now: Date): Date {
    return new Date(getStartOfDayAR(now).getTime() + DAY_MS);
}
