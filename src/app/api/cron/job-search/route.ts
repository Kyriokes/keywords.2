import { timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import { runAndRecord, type FetchCache } from "@/lib/ingest/run";
import { SEARCH_SETTINGS_SELECT } from "@/lib/ingest/settings";

// Búsqueda diaria de ofertas para todos los que la activaron. La llama el cron de Vercel
// (vercel.json) con `Authorization: Bearer $CRON_SECRET`; es ruta pública en el proxy.

export const maxDuration = 300;

// Margen antes del límite de la función: los que no entran hoy van primero mañana
const TIME_BUDGET_MS = 240_000;

function isAuthorized(request: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(request.headers.get("authorization") ?? "");
    return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const started = Date.now();
    const pending = await prisma.jobSearchSettings.findMany({
        where: { enabled: true },
        // Los que hace más tiempo que no se buscan, primero
        orderBy: { lastRunAt: { sort: "asc", nulls: "first" } },
        select: SEARCH_SETTINGS_SELECT,
    });

    const cache: FetchCache = new Map();
    let processed = 0;
    let created = 0;
    for (const settings of pending) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        try {
            const result = await runAndRecord(settings.profileId, settings, cache, "CRON");
            created += result.created;
        } catch (error) {
            console.error(`Job search failed for ${settings.profileId}:`, error);
        }
        processed++;
    }

    return Response.json({ processed, total: pending.length, created });
}
