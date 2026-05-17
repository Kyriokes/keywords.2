"use server";

import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export type QuotaCheckResult =
    | { allowed: true }
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
            id: true,
            role: true,
            dailyAnalysesUsed: true,
            dailyAnalysesLimit: true,
            dailyAnalysesDate: true,
        },
    });

    if (!user) {
        return { allowed: false, reason: "USER_NOT_FOUND" };
    }

    // ADMIN no tiene límite
    if (user.role === UserRole.ADMIN) {
        return { allowed: true };
    }

    // Calcular si hay que resetear el contador (nuevo día en Argentina, UTC-3)
    const now = new Date();
    const todayAR = getArgentineDateString(now);
    const lastUseDateAR = user.dailyAnalysesDate
        ? getArgentineDateString(user.dailyAnalysesDate)
        : null;

    const isNewDay = lastUseDateAR !== todayAR;
    const currentUsed = isNewDay ? 0 : user.dailyAnalysesUsed;

    // Verificar si tiene cupo
    if (currentUsed >= user.dailyAnalysesLimit) {
        const resetsAt = getNextMidnightAR(now);
        return {
            allowed: false,
            reason: "QUOTA_EXCEEDED",
            usedToday: currentUsed,
            limit: user.dailyAnalysesLimit,
            resetsAt,
        };
    }

    // Consumir el cupo atómicamente
    await prisma.user.update({
        where: { id: userId },
        data: {
            dailyAnalysesUsed: currentUsed + 1,
            dailyAnalysesDate: now,
        },
    });

    return { allowed: true };
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
    const todayAR = getArgentineDateString(now);
    const lastUseDateAR = user.dailyAnalysesDate
        ? getArgentineDateString(user.dailyAnalysesDate)
        : null;

    const isNewDay = lastUseDateAR !== todayAR;
    const used = isNewDay ? 0 : user.dailyAnalysesUsed;

    return {
        used,
        limit: user.dailyAnalysesLimit,
        isAdmin: user.role === UserRole.ADMIN,
        resetsAt: getNextMidnightAR(now),
    };
}

// ─── Helpers de Timezone ────────────────────────────────────────────────────

/**
 * Devuelve la fecha en Argentina como string "YYYY-MM-DD".
 * Argentina es UTC-3 (sin DST).
 */
function getArgentineDateString(date: Date): string {
    return date.toLocaleDateString("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
    });
    // 'en-CA' devuelve formato YYYY-MM-DD, ideal para comparar
}

/**
 * Devuelve la próxima medianoche en Argentina como Date UTC.
 */
function getNextMidnightAR(now: Date): Date {
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

    // Medianoche del día siguiente en AR = 03:00 UTC del día siguiente (AR = UTC-3)
    const nextDayAR = new Date(Date.UTC(year, month, day + 1, 3, 0, 0));
    return nextDayAR;
}

export async function getMyQuotaStatus() {
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user?.id) return null;
    return getQuotaStatus(session.user.id);
}