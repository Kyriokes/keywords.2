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

/** Normaliza keywords: minúsculas, sin vacías ni duplicadas, descarta las demasiado largas y recorta la lista. */
export function sanitizeKeywords(keywords: unknown, max: number): string[] {
    if (!Array.isArray(keywords)) return [];

    const unique = new Set<string>();
    for (const keyword of keywords) {
        if (unique.size >= max) break;
        if (typeof keyword !== "string") continue;
        const normalized = keyword.trim().toLowerCase();
        if (!normalized || normalized.length > LIMITS.keywordLength) continue;
        unique.add(normalized);
    }
    return Array.from(unique);
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

export const createApplicationSchema = z.object({
    jobTitle: title,
    jobDescription: z
        .string()
        .max(LIMITS.jobDescription, `La descripción supera el máximo de ${LIMITS.jobDescription} caracteres.`),
    link: optionalLink,
    detectedWords: z.unknown().transform((value) => sanitizeKeywords(value, LIMITS.applicationKeywords)),
    positionTitle: title.optional(),
    provider: z.string().optional(),
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
