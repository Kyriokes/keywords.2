import { z } from "zod";
import { SENIORITY_POLICIES, WORK_MODES } from "@/lib/ingest/eligibility";
import { SKIP_REASONS } from "@/lib/applications/skipReasons";
import { SENIORITY_LEVELS } from "@/lib/positions/rules";
import { PREFERENCE_KINDS } from "@/lib/preferences/kinds";

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
    company: 200,
    source: 50,
    externalId: 200,
    notes: 5_000,
    question: 1_000,
    answer: 10_000,
    answersPerApplication: 100,
    answerTemplates: 300,
    templateTags: 10,
    coverLetter: 20_000,
    agentTokens: 10,
    agentTokenName: 100,
    coverLetterTemplates: 20,
    mediaAssets: 10,
    coverLettersPerDay: 60,
    atsBoards: 30,
    cvFilePath: 500,
    searchMaxPerRun: 60,
    preferences: 200,
    preferenceValue: 80,
    skipDetail: 200,
    maxPerCompanyPerMonth: 10,
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

/** PostgreSQL no guarda el carácter nulo en un texto: llega en algunos PDF y textos pegados, y rompía el guardado. */
const withoutNul = (value: string) => value.replace(/\u0000/g, "");

const title = z
    .string()
    .overwrite(withoutNul)
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

export const APPLICATION_STATUSES = [
    "APPLIED",
    "INTERVIEW",
    "SAVED",
    "REJECTED",
    // Postulación asistida: en cola, aprobada para enviar, descartada o trabada esperando al usuario
    "READY",
    "APPROVED",
    "SKIPPED",
    "NEEDS_USER",
] as const;

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

/** Quién envía la postulación: el usuario a mano (Easy Apply) o el agente en un formulario externo. */
export const APPLY_MODES = ["EASY_APPLY_MANUAL", "EXTERNAL_FORM", "UNSUPPORTED"] as const;

export type ApplyMode = typeof APPLY_MODES[number];

const optionalText = (max: number) =>
    z
        .string()
        .optional()
        .transform((value) => (value === undefined ? undefined : withoutNul(value).trim().slice(0, max) || undefined));

export const createApplicationSchema = z.object({
    jobTitle: title,
    jobDescription: z
        .string()
        .overwrite(withoutNul)
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
    company: optionalText(LIMITS.company),
    source: optionalText(LIMITS.source),
    applyUrl: optionalLink,
    applyMode: z.enum(APPLY_MODES).optional(),
    externalId: optionalText(LIMITS.externalId),
    score: z.number().int().min(0).max(100).optional(),
    notes: optionalText(LIMITS.notes),
    // Nivel que la búsqueda dedujo del portal o de la descripción, para cuando el título no lo dice
    seniority: z.enum(SENIORITY_LEVELS).optional(),
});

export const uploadCvSchema = z.object({
    name: z
        .string()
        .overwrite(withoutNul)
        .trim()
        .min(1, "El CV necesita un nombre.")
        .transform((value) => value.slice(0, LIMITS.cvName)),
    text: z.string().overwrite(withoutNul).max(LIMITS.cvText, `El texto del CV supera el máximo de ${LIMITS.cvText} caracteres.`),
    keywords: z.unknown().transform((value) => sanitizeKeywords(value, LIMITS.cvKeywords)),
});

export const positionTitlesSchema = z
    .array(z.string())
    .transform((titles) =>
        Array.from(new Set(titles.map((value) => value.trim().slice(0, LIMITS.title)).filter(Boolean)))
    )
    .refine((titles) => titles.length <= LIMITS.positions, `Podés guardar hasta ${LIMITS.positions} puestos.`);

/** Cómo usa Claude una respuesta tipo: copiarla tal cual (datos) o reescribirla para la oferta (texto libre). */
export const ANSWER_MODES = ["VERBATIM", "ADAPT"] as const;
export type AnswerMode = typeof ANSWER_MODES[number];

/** De dónde salió una respuesta enviada: plantilla tal cual, plantilla adaptada, la dio el usuario en el chat, la escribió Claude desde el CV. */
export const ANSWER_ORIGINS = ["TEMPLATE", "ADAPTED", "NEW", "AGENT"] as const;
export type AnswerOrigin = typeof ANSWER_ORIGINS[number];

export const answerTemplateSchema = z.object({
    question: z.string().trim().min(1, "La pregunta no puede estar vacía.").max(LIMITS.question, "La pregunta es demasiado larga."),
    answer: z.string().trim().min(1, "La respuesta no puede estar vacía.").max(LIMITS.answer, "La respuesta es demasiado larga."),
    tags: z.unknown().optional().transform((value) => sanitizeKeywords(value ?? [], LIMITS.templateTags)),
    language: optionalText(10),
    mode: z.enum(ANSWER_MODES).default("VERBATIM"),
});

export const coverLetterTemplateSchema = z.object({
    name: z.string().trim().min(1, "Poné un nombre para reconocer la carta.").max(LIMITS.title),
    text: z.string().trim().min(1, "La carta no puede estar vacía.").max(LIMITS.coverLetter, "La carta es demasiado larga."),
});

export const mediaAssetSchema = z.object({
    name: z.string().trim().min(1, "Poné un nombre.").max(LIMITS.title),
    url: z.string().transform((value, ctx) => {
        const link = normalizeLink(value);
        if (!link) {
            ctx.addIssue({ code: "custom", message: "El link debe ser una dirección web válida (http o https)." });
            return z.NEVER;
        }
        return link;
    }),
});

export const jobSearchSettingsSchema = z.object({
    enabled: z.boolean(),
    sources: z.array(z.string()).max(10),
    // Una empresa por línea, como "greenhouse:stripe"; se validan contra los ATS conocidos al guardar
    atsBoards: z.array(z.string().trim().toLowerCase()).transform((boards) => Array.from(new Set(boards.filter(Boolean)))),
    minScore: z.number().int().min(0).max(100),
    maxPerRun: z.number().int().min(1).max(LIMITS.searchMaxPerRun),
    workModes: z
        .array(z.enum(WORK_MODES))
        .min(1, "Elegí al menos una modalidad.")
        .transform((modes) => Array.from(new Set(modes))),
    seniorityPolicy: z.enum(SENIORITY_POLICIES),
    // Vacío = nunca aceptar mudarse
    minRelocationSalaryUsd: z.number().int().min(0).max(1_000_000).nullable().default(null),
    // Vacío = nunca aprobar sola
    autoApproveMinScore: z.number().int().min(0).max(100).nullable().default(null),
    // Vacío = no mirar el sueldo publicado
    minSalaryUsdMonthly: z.number().int().min(0).max(1_000_000).nullable().default(null),
    minSalaryArsMonthly: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
    maxPerCompanyPerMonth: z.number().int().min(1).max(LIMITS.maxPerCompanyPerMonth).default(2),
});

/** Reglas de la búsqueda que el agente puede cambiar desde el chat; todas opcionales, se guarda solo lo que viene. */
export const searchRulesSchema = z.object({
    autoApproveMinScore: z.number().int().min(0).max(100).nullable().optional(),
    minSalaryUsdMonthly: z.number().int().min(0).max(1_000_000).nullable().optional(),
    minSalaryArsMonthly: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    maxPerCompanyPerMonth: z.number().int().min(1).max(LIMITS.maxPerCompanyPerMonth).optional(),
});

/** Una preferencia del usuario: tecnología o empresa a evitar, o una frase que descarta la oferta. */
export const preferenceSchema = z.object({
    kind: z.enum(PREFERENCE_KINDS),
    value: z.string().trim().min(1, "Escribí qué evitar.").max(LIMITS.preferenceValue, "El valor es demasiado largo."),
    note: z.string().trim().max(LIMITS.notes).optional(),
});

/** Motivo de un descarte hecho por el usuario (en la web o en el chat). */
export const skipReasonSchema = z.object({
    reason: z.enum(SKIP_REASONS).optional(),
    detail: z.string().trim().max(LIMITS.skipDetail).optional(),
});

/** Idiomas en los que el usuario puede tener su CV; `/postular` elige el del idioma de la oferta. */
export const CV_LANGUAGES = ["en", "es"] as const;

/** Archivo de un CV para subir en los formularios: idioma, link público al PDF y ruta en la PC del usuario. */
export const cvFileSchema = z.object({
    language: z.enum(CV_LANGUAGES).nullable(),
    fileUrl: z
        .string()
        .transform((value, ctx) => {
            if (!value.trim()) return null;
            const link = normalizeLink(value);
            if (!link) {
                ctx.addIssue({ code: "custom", message: "El link al PDF debe ser una dirección web válida (http o https)." });
                return z.NEVER;
            }
            return link;
        }),
    filePath: z
        .string()
        .trim()
        .max(LIMITS.cvFilePath, "La ruta del archivo es demasiado larga.")
        // Una ruta de archivo no lleva saltos de línea ni caracteres de control
        .refine((value) => !/[\u0000-\u001f]/.test(value), "La ruta del archivo no es válida.")
        .transform((value) => value || null),
});

/** Primer mensaje de error de un safeParse fallido, para mostrar al usuario. */
export function firstIssueMessage(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Datos inválidos.";
}
