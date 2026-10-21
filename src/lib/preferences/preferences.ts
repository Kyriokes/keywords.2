import "server-only";

import prisma from "@/lib/prisma";
import { detectKeywords } from "@/lib/keywords/dictionary";
import { LIMITS, type ActionResult } from "@/lib/validation";
import { normalizePreferenceKey, type PreferenceKind, type PreferenceOrigin } from "./kinds";

export interface PreferenceRow {
    id: string;
    kind: string;
    value: string;
    origin: string;
    note: string | null;
    createdAt: string;
}

export async function listPreferences(profileId: string): Promise<PreferenceRow[]> {
    const rows = await prisma.searchPreference.findMany({
        where: { profileId },
        orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
        select: { id: true, kind: true, value: true, origin: true, note: true, createdAt: true },
    });
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export interface SavePreferenceInput {
    kind: PreferenceKind;
    value: string;
    origin?: PreferenceOrigin;
    note?: string;
}

/** Guarda una preferencia; si ya existía (misma clase y valor, sin importar mayúsculas), la devuelve sin tocarla. */
export async function savePreference(
    profileId: string,
    input: SavePreferenceInput
): Promise<ActionResult<{ id: string; value: string; created: boolean }>> {
    const value = input.value.trim().slice(0, LIMITS.preferenceValue);
    const valueKey = normalizePreferenceKey(value);
    if (!valueKey) return { ok: false, code: "INVALID_INPUT", message: "Escribí qué evitar." };

    const existing = await prisma.searchPreference.findUnique({
        where: { profileId_kind_valueKey: { profileId, kind: input.kind, valueKey } },
        select: { id: true, value: true },
    });
    if (existing) return { ok: true, data: { id: existing.id, value: existing.value, created: false } };

    const total = await prisma.searchPreference.count({ where: { profileId } });
    if (total >= LIMITS.preferences) {
        return { ok: false, code: "LIMIT_REACHED", message: `Alcanzaste el máximo de ${LIMITS.preferences} preferencias.` };
    }

    const created = await prisma.searchPreference.create({
        data: {
            profileId,
            kind: input.kind,
            value,
            valueKey,
            origin: input.origin ?? "USER",
            note: input.note?.trim().slice(0, LIMITS.notes) || null,
        },
        select: { id: true },
    });
    return { ok: true, data: { id: created.id, value, created: true } };
}

/** Borra una preferencia del perfil; false si no existía. */
export async function deletePreference(profileId: string, id: string): Promise<boolean> {
    const result = await prisma.searchPreference.deleteMany({ where: { id, profileId } });
    return result.count > 0;
}

/** Las preferencias listas para que la búsqueda las aplique. */
export interface PreferenceRules {
    /** Tecnologías a evitar, como las escribió el usuario. */
    avoidTechNames: string[];
    /** Ids de esas tecnologías en el diccionario de keywords (las que el diccionario conoce). */
    avoidTechKeywordIds: Set<string>;
    /** Empresas a evitar, normalizadas con normalizePreferenceKey. */
    avoidCompanyKeys: Set<string>;
    /** Frases que descartan la oferta, como las escribió el usuario. */
    avoidPhrases: string[];
}

export const EMPTY_PREFERENCE_RULES: PreferenceRules = {
    avoidTechNames: [],
    avoidTechKeywordIds: new Set(),
    avoidCompanyKeys: new Set(),
    avoidPhrases: [],
};

export async function loadPreferenceRules(profileId: string): Promise<PreferenceRules> {
    const rows = await prisma.searchPreference.findMany({
        where: { profileId },
        select: { kind: true, value: true, valueKey: true },
    });
    if (rows.length === 0) return EMPTY_PREFERENCE_RULES;

    const techs = rows.filter((row) => row.kind === "AVOID_TECH");
    // El diccionario traduce "Node.JS" o "node" al mismo id que detecta en las ofertas
    const techIds = await Promise.all(techs.map((row) => detectKeywords(row.value)));
    return {
        avoidTechNames: techs.map((row) => row.value),
        avoidTechKeywordIds: new Set(techIds.flat().map((keyword) => keyword.id)),
        avoidCompanyKeys: new Set(rows.filter((row) => row.kind === "AVOID_COMPANY").map((row) => row.valueKey)),
        avoidPhrases: rows.filter((row) => row.kind === "AVOID_PHRASE").map((row) => row.value),
    };
}
