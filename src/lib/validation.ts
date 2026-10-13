import { z } from "zod";

export const LIMITS = {
    title: 200,
    jobDescription: 40_000,
    link: 2_048,
    keywordLength: 80,
    applicationKeywords: 100,
    applicationsPerProfile: 5_000,
    cvName: 255,
    cvText: 200_000,
    cvKeywords: 2_000,
    cvsPerProfile: 20,
    positions: 10,
} as const;

/** Resultado de las server actions cuyos errores esperados se muestran al usuario. */
export type ActionResult<T = undefined> =
    | { ok: true; data: T }
    | { ok: false; code: string; message: string };

/**
 * Limpia una lista de términos conservando cómo están escritos: sin vacíos, sin repetidos
 * (ignorando mayúsculas), descarta los demasiado largos y recorta la lista.
 */
export function sanitizeTerms(terms: unknown, max: number): string[] {
    if (!Array.isArray(terms)) return [];

    const unique = new Map<string, string>();
    for (const term of terms) {
        if (unique.size >= max) break;
        if (typeof term !== "string") continue;
        const trimmed = term.trim();
        if (!trimmed || trimmed.length > LIMITS.keywordLength) continue;
        const key = trimmed.toLowerCase();
        if (!unique.has(key)) unique.set(key, trimmed);
    }
    return Array.from(unique.values());
}

/** Como `sanitizeTerms`, pero devuelve todo en minúsculas. */
export function sanitizeKeywords(keywords: unknown, max: number): string[] {
    return sanitizeTerms(keywords, max).map((keyword) => keyword.toLowerCase());
}

/**
 * Devuelve el link listo para guardar, o null si no es una URL http(s).
 * Un link sin esquema ("www.sitio.com/oferta") se asume https.
 */
export function normalizeLink(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > LIMITS.link) return null;

    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const { protocol } = new URL(withScheme);
        return protocol === "http:" || protocol === "https:" ? withScheme : null;
    } catch {
        return null;
    }
}

const title = z
    .string()
    .trim()
    .min(1, "El título no puede estar vacío.")
    .transform((value) => value.slice(0, LIMITS.title));

const optionalLink = z
    .string()
    .optional()
    .transform((value, ctx) => {
        if (!value?.trim()) return undefined;
        const link = normalizeLink(value);
        if (!link) {
            ctx.addIssue({ code: "custom", message: "El link debe ser una dirección web válida (http o https)." });
            return z.NEVER;
        }
        return link;
    });

export const APPLICATION_STATUSES = ["APPLIED", "INTERVIEW", "SAVED", "REJECTED"] as const;

export type ApplicationStatusValue = typeof APPLICATION_STATUSES[number];

/** Estado de una postulación importada; lo que no se reconoce se descarta y queda el valor por defecto. */
export function parseApplicationStatus(value: unknown): ApplicationStatusValue | undefined {
    return (APPLICATION_STATUSES as readonly unknown[]).includes(value) ? (value as ApplicationStatusValue) : undefined;
}

/**
 * Fecha de una postulación importada, en formato AAAA-MM-DD. Una fecha ilegible, anterior
 * al 2000 o futura se descarta: es preferible la fecha de hoy a una inventada.
 */
export function parseApplicationDate(value: unknown, now: Date = new Date()): Date | undefined {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return undefined;

    const date = new Date(`${value.trim()}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return undefined;
    // El motor acepta "2024-02-31" y lo corre a marzo: si no vuelve igual, la fecha no existía
    if (date.toISOString().slice(0, 10) !== value.trim()) return undefined;
    if (date.getUTCFullYear() < 2000) return undefined;
    // Un día de margen por la diferencia horaria entre quien exporta y el servidor
    if (date.getTime() > now.getTime() + 24 * 60 * 60 * 1000) return undefined;

    return date;
}

export const createApplicationSchema = z.object({
    jobTitle: title,
    jobDescription: z
        .string()
        .max(LIMITS.jobDescription, `La descripción supera el máximo de ${LIMITS.jobDescription} caracteres.`),
    link: optionalLink,
    // Se conserva la escritura original: es el nombre visible de los términos que el diccionario no conoce
    detectedWords: z.unknown().transform((value) => sanitizeTerms(value, LIMITS.applicationKeywords)),
    positionTitle: title.optional(),
    provider: z.string().optional(),
    reviewed: z.boolean().optional(),
    // Solo los manda la importación de un respaldo, para no perder el historial
    date: z.unknown().optional().transform((value) => parseApplicationDate(value)),
    status: z.unknown().optional().transform(parseApplicationStatus),
});

export const uploadCvSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "El CV necesita un nombre.")
        .transform((value) => value.slice(0, LIMITS.cvName)),
    text: z.string().max(LIMITS.cvText, `El texto del CV supera el máximo de ${LIMITS.cvText} caracteres.`),
    keywords: z.unknown().transform((value) => sanitizeKeywords(value, LIMITS.cvKeywords)),
});

export const positionTitlesSchema = z
    .array(z.string())
    .transform((titles) =>
        Array.from(new Set(titles.map((value) => value.trim().slice(0, LIMITS.title)).filter(Boolean)))
    )
    .refine((titles) => titles.length <= LIMITS.positions, `Podés guardar hasta ${LIMITS.positions} puestos.`);

/** Primer mensaje de error de un safeParse fallido, para mostrar al usuario. */
export function firstIssueMessage(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Datos inválidos.";
}
