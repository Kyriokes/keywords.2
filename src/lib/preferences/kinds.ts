// Tipos de preferencia que KeyWords recuerda del usuario. Sin Prisma: lo importan los componentes y el agente.
import type { SkipReason } from "@/lib/applications/skipReasons";

export const PREFERENCE_KINDS = ["AVOID_TECH", "AVOID_COMPANY", "AVOID_PHRASE"] as const;
export type PreferenceKind = typeof PREFERENCE_KINDS[number];

export const PREFERENCE_KIND_LABELS: Record<PreferenceKind, string> = {
    AVOID_TECH: "Tecnología a evitar",
    AVOID_COMPANY: "Empresa a evitar",
    AVOID_PHRASE: "Frase que descarta",
};

/** Cómo se cuenta lo aprendido: "KeyWords ya no trae ofertas de PHP". */
export const LEARNED_LABELS: Record<PreferenceKind, (value: string) => string> = {
    AVOID_TECH: (value) => `ya no trae ofertas de ${value}`,
    AVOID_COMPANY: (value) => `ya no trae ofertas de ${value}`,
    AVOID_PHRASE: (value) => `descarta las ofertas que dicen "${value}"`,
};

export const PREFERENCE_ORIGINS = ["USER", "LEARNED"] as const;
export type PreferenceOrigin = typeof PREFERENCE_ORIGINS[number];

/** Qué preferencia sale de cada motivo de descarte; los demás motivos no enseñan nada reutilizable. */
export const LEARNED_FROM: Partial<Record<SkipReason, PreferenceKind>> = {
    TECH: "AVOID_TECH",
    COMPANY: "AVOID_COMPANY",
};

export function isPreferenceKind(value: unknown): value is PreferenceKind {
    return typeof value === "string" && Object.hasOwn(PREFERENCE_KIND_LABELS, value);
}

/** "  Node.JS " y "node.js" son la misma preferencia: minúsculas, sin acentos ni espacios de más. */
export function normalizePreferenceKey(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
