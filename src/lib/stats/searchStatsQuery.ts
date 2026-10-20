import "server-only";

import prisma from "@/lib/prisma";
import type { SourceStats } from "@/lib/ingest/stats";
import {
    buildFunnel,
    rankCompanies,
    rankRoles,
    rankSources,
    summarizeAnswers,
    summarizeReasons,
    type AnswerStats,
    type CompanyRank,
    type Funnel,
    type ReasonCount,
    type RoleRank,
    type SourceRank,
    type StatsPeriod,
} from "./searchStats";

/** Búsquedas que se muestran en el historial. */
const RECENT_RUNS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RunSummary {
    startedAt: string;
    trigger: string;
    fetched: number;
    fresh: number;
    created: number;
    deferred: number;
    durationMs: number;
    errors: string[];
}

export interface SearchStats {
    days: StatsPeriod;
    funnel: Funnel;
    sources: SourceRank[];
    reasons: ReasonCount[];
    companies: CompanyRank[];
    roles: RoleRank[];
    runs: RunSummary[];
    answers: AnswerStats;
    /** Texto para mostrar cuando todavía no hay búsquedas registradas; null si hay datos. */
    emptyReason: string | null;
}

const EMPTY_REASON =
    'Todavía no hay búsquedas registradas. Se guardan desde ahora, con cada búsqueda del cron, de "Buscar ahora" o de Claude.';

/** Qué trajo cada portal, qué se descartó y qué terminó en entrevista en los últimos `days` días. */
export async function loadSearchStats(profileId: string, days: StatsPeriod, now: Date = new Date()): Promise<SearchStats> {
    const since = new Date(now.getTime() - days * DAY_MS);

    const [offers, applications, runs, answers, templates] = await Promise.all([
        prisma.ingestedOffer.findMany({
            where: { profileId, firstSeenAt: { gte: since } },
            select: { source: true, board: true, company: true, roleName: true, decision: true, reason: true, score: true },
        }),
        prisma.jobApplication.findMany({
            where: { profileId, date: { gte: since } },
            select: { source: true, status: true, company: true },
        }),
        prisma.searchRun.findMany({
            where: { profileId },
            orderBy: { startedAt: "desc" },
            take: RECENT_RUNS,
            select: {
                startedAt: true,
                trigger: true,
                fetched: true,
                fresh: true,
                created: true,
                deferred: true,
                durationMs: true,
                errors: true,
                bySource: true,
            },
        }),
        prisma.applicationAnswer.findMany({
            where: { application: { profileId, date: { gte: since } } },
            select: { question: true, templateId: true, origin: true },
        }),
        prisma.answerTemplate.findMany({ where: { profileId }, select: { id: true, question: true } }),
    ]);

    const lastRunBySource = (runs[0]?.bySource ?? {}) as unknown as Record<string, SourceStats>;

    return {
        days,
        funnel: buildFunnel(offers, applications),
        sources: rankSources(offers, applications, lastRunBySource),
        reasons: summarizeReasons(offers.filter((offer) => offer.decision === "REJECTED").map((offer) => offer.reason)),
        companies: rankCompanies(offers),
        roles: rankRoles(offers),
        runs: runs.map((run) => ({
            startedAt: run.startedAt.toISOString(),
            trigger: run.trigger,
            fetched: run.fetched,
            fresh: run.fresh,
            created: run.created,
            deferred: run.deferred,
            durationMs: run.durationMs,
            errors: run.errors,
        })),
        // Las respuestas de antes de guardar el origen cuentan como "sin dato"
        answers: summarizeAnswers(answers, templates),
        emptyReason: runs.length === 0 ? EMPTY_REASON : null,
    };
}
