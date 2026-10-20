// Tipos y constantes de las estadísticas de la búsqueda. Sin Prisma: lo pueden importar los componentes.
import { ATS_SOURCES, SOURCE_LABELS, type IngestedJob } from "./sources";

/** Quién disparó la búsqueda: el cron diario, "Buscar ahora" o el agente (`search_now`). */
export const RUN_TRIGGERS = ["CRON", "MANUAL", "AGENT"] as const;
export type RunTrigger = typeof RUN_TRIGGERS[number];

export const OFFER_DECISIONS = ["QUEUED", "PASSES", "REJECTED", "OTHER_ROLE", "IN_ACCOUNT"] as const;
export type OfferDecision = typeof OFFER_DECISIONS[number];
export const DECISION_LABELS: Record<OfferDecision, string> = {
    QUEUED: "Entró a la cola",
    PASSES: "Pasa los filtros; entra en la próxima búsqueda",
    REJECTED: "Descartada por los filtros",
    OTHER_ROLE: "No es de tus puestos",
    IN_ACCOUNT: "Ya estaba en tu cuenta",
};

/** Qué pasó con una fuente en una búsqueda. `fetched` cuenta repetidas; `fresh`, las que no estaban en la cuenta. */
export interface SourceStats {
    fetched: number;
    fresh: number;
    matchedRole: number;
    passed: number;
    rejected: number;
    error: string | null;
}

export function emptySourceStats(): SourceStats {
    return { fetched: 0, fresh: 0, matchedRole: 0, passed: 0, rejected: 0, error: null };
}

/** "greenhouse" + "stripe" para las de ATS (el board es lo que va antes del primer ":" en externalId); board null para los agregadores. */
export function sourceOf(job: Pick<IngestedJob, "source" | "externalId">): { source: string; board: string | null } {
    if (!(ATS_SOURCES as readonly string[]).includes(job.source)) return { source: job.source, board: null };
    return { source: job.source, board: job.externalId.split(":")[0] || null };
}

const ORIGIN_LABELS: Record<string, string> = {
    ...SOURCE_LABELS,
    manual: "Cargadas a mano",
    agent: "Cargadas desde Claude",
};

/** Nombre para mostrar de un portal o del origen de una postulación. */
export function sourceLabel(source: string | null): string {
    if (source === null) return "Sin origen";
    return Object.hasOwn(ORIGIN_LABELS, source) ? ORIGIN_LABELS[source] : source;
}

/** Lo que la búsqueda registra de cada oferta que llegó. */
export interface IngestedOfferInput {
    /** Igual que JobApplication.externalId: "remotive:123", "greenhouse:stripe:456". */
    externalId: string;
    source: string;
    board: string | null;
    title: string;
    company: string | null;
    location: string | null;
    url: string;
    roleName: string | null;
    seniority: string | null;
    decision: OfferDecision;
    reason: string | null;
    score: number | null;
}
