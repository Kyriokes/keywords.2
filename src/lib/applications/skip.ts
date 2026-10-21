import "server-only";

import prisma from "@/lib/prisma";
import { detectKeywords } from "@/lib/keywords/dictionary";
import { LEARNED_FROM, type PreferenceKind } from "@/lib/preferences/kinds";
import { savePreference } from "@/lib/preferences/preferences";
import { appendNote } from "./notes";
import { skipNote, type SkipReason } from "./skipReasons";

export interface SkipInput {
    id: string;
    reason?: SkipReason;
    detail?: string;
}

/** Una preferencia nueva que salió de un descarte. */
export interface Learned {
    kind: PreferenceKind;
    value: string;
}

export interface SkipResult {
    skipped: string[];
    learned: Learned[];
}

const dateLabel = (date: Date) => date.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

/**
 * Descarta ofertas guardando el motivo y aprende de él: un descarte por tecnología o por empresa
 * crea la preferencia para que la búsqueda no las traiga más. Solo toca ofertas del perfil que estén
 * en uno de los estados permitidos.
 */
export async function skipApplications(profileId: string, items: SkipInput[], allowedStatuses: readonly string[]): Promise<SkipResult> {
    const byId = new Map(items.map((item) => [item.id, item]));
    if (byId.size === 0) return { skipped: [], learned: [] };

    const found = await prisma.jobApplication.findMany({
        where: { id: { in: Array.from(byId.keys()) }, profileId, status: { in: [...allowedStatuses] } },
        select: { id: true, company: true, jobTitle: true, notes: true },
    });

    const skipped: string[] = [];
    const learned: Learned[] = [];
    for (const application of found) {
        const input = byId.get(application.id)!;
        const detail = input.detail?.trim() || undefined;
        await prisma.jobApplication.update({
            where: { id: application.id },
            data: {
                status: "SKIPPED",
                skipReason: input.reason ?? null,
                skipDetail: detail ?? null,
                notes: appendNote(application.notes, skipNote(input.reason, detail)),
            },
        });
        skipped.push(application.id);

        const kind = input.reason ? LEARNED_FROM[input.reason] : undefined;
        if (!kind) continue;
        const value = await learnedValue(kind, detail, application.company);
        if (!value) continue;
        const saved = await savePreference(profileId, {
            kind,
            value,
            origin: "LEARNED",
            note: `Descartaste ${application.company ?? "una oferta"} (${application.jobTitle}) el ${dateLabel(new Date())}`,
        });
        if (saved.ok && saved.data.created) learned.push({ kind, value: saved.data.value });
    }

    return { skipped, learned };
}

/** Qué se guarda: la tecnología con el nombre del diccionario si la conoce, o la empresa de la oferta. */
async function learnedValue(kind: PreferenceKind, detail: string | undefined, company: string | null): Promise<string | null> {
    if (kind === "AVOID_COMPANY") return detail ?? company;
    if (!detail) return null;
    const [known] = await detectKeywords(detail);
    return known?.name ?? detail;
}
