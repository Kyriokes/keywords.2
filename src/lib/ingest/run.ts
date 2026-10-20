import "server-only";

import prisma from "@/lib/prisma";
import { applyModeForUrl } from "@/lib/applications/applyMode";
import { createApplicationForProfile } from "@/lib/applications/create";
import { computeMatchScore } from "@/lib/applications/prepare";
import { detectKeywords } from "@/lib/keywords/dictionary";
import { classifyJobTitle } from "@/lib/positions/dictionary";
import { LIMITS, type ActionResult } from "@/lib/validation";
import {
    DEFAULT_WORK_MODES,
    SENIORITY_POLICIES,
    WORK_MODES,
    checkEligibility,
    type EligibilityRules,
    type SeniorityPolicy,
    type WorkMode,
} from "./eligibility";
import {
    AGGREGATOR_SOURCES,
    SEARCH_BY_TERM_SOURCES,
    fetchAggregator,
    fetchAtsBoard,
    parseAtsBoard,
    type AggregatorSource,
    type IngestedJob,
} from "./sources";
import { saveSearchRun } from "./record";
import { emptySourceStats, sourceOf, type IngestedOfferInput, type RunTrigger, type SourceStats } from "./stats";

/**
 * Pedidos compartidos entre los usuarios de una misma búsqueda: cada portal se consulta una
 * sola vez aunque lo usen muchos, para no castigar sus APIs ni el tiempo de la función.
 */
export type FetchCache = Map<string, Promise<IngestedJob[]>>;

export interface SearchSettingsInput {
    sources: string[];
    atsBoards: string[];
    minScore: number;
    maxPerRun: number;
    workModes: string[];
    seniorityPolicy: string;
    minRelocationSalaryUsd: number | null;
}

/** Qué pasó con una oferta de tus puestos: entró a la cola, entraría (modo prueba) o se descartó y por qué. */
export interface SearchDecision {
    externalId: string;
    title: string;
    company: string | null;
    location: string | null;
    url: string;
    status: "QUEUED" | "PASSES" | "REJECTED";
    reason: string | null;
    score: number | null;
    summary: string;
}

export interface SearchRunResult {
    fetched: number;
    /** Las que no estaban en la cuenta. */
    fresh: number;
    matchedRole: number;
    /** Ofertas de tus puestos descartadas por los filtros o por el match con el CV. */
    filtered: number;
    created: number;
    /** Pasan los filtros pero la cola ya estaba llena: entran en la próxima búsqueda. */
    deferred: number;
    decisions: SearchDecision[];
    errors: string[];
    summary: string;
    /** Todas las ofertas que llegaron, con lo que pasó con cada una. Sin tope: es lo que se guarda en las estadísticas. */
    offers: IngestedOfferInput[];
    /** Qué trajo cada pedido; la clave es la del pedido ("remotive", "greenhouse:stripe"). */
    bySource: Record<string, SourceStats>;
}

// Lo que se muestra en "Probar filtros"; más que esto no se llega a revisar a mano
const MAX_DECISIONS = 200;

/** Categorías que forman el stack: si el título nombra alguna tecnología, al menos una tiene que estar en el CV. */
const STACK_CATEGORIES = new Set<string>(["LENGUAJE", "FRAMEWORK", "DATOS", "CLOUD_DEVOPS"]);

const ingestKey = (job: IngestedJob) => `${job.source}:${job.externalId}`;

/** Reglas de los filtros a partir de lo guardado; un valor desconocido vuelve al de por defecto. */
function toRules(settings: SearchSettingsInput): EligibilityRules {
    const workModes = settings.workModes.filter((mode): mode is WorkMode => (WORK_MODES as readonly string[]).includes(mode));
    const seniorityPolicy = (SENIORITY_POLICIES as readonly string[]).includes(settings.seniorityPolicy)
        ? (settings.seniorityPolicy as SeniorityPolicy)
        : "FLEXIBLE";
    return {
        workModes: workModes.length ? workModes : DEFAULT_WORK_MODES,
        seniorityPolicy,
        minScore: settings.minScore,
        minRelocationSalaryUsd: settings.minRelocationSalaryUsd,
    };
}

function cached(cache: FetchCache, key: string, load: () => Promise<IngestedJob[]>): Promise<IngestedJob[]> {
    let pending = cache.get(key);
    if (!pending) {
        pending = load();
        cache.set(key, pending);
    }
    return pending;
}

/**
 * Busca ofertas para un perfil y deja en la cola (READY) las que encajan con sus puestos y su CV
 * y pasan los filtros. Con `dryRun` no guarda nada: cuenta qué entraría y por qué se descarta el resto.
 */
export async function runJobSearch(
    profileId: string,
    settings: SearchSettingsInput,
    cache: FetchCache = new Map(),
    opts: { dryRun?: boolean } = {}
): Promise<SearchRunResult> {
    const result: SearchRunResult = {
        fetched: 0,
        fresh: 0,
        matchedRole: 0,
        filtered: 0,
        created: 0,
        deferred: 0,
        decisions: [],
        errors: [],
        summary: "",
        offers: [],
        bySource: {},
    };
    const finish = (summary: string) => ({ ...result, summary });

    const [positions, activeCv] = await Promise.all([
        prisma.position.findMany({ where: { profileId }, select: { title: true } }),
        prisma.cV.findFirst({ where: { profileId, isPrimary: true }, select: { id: true } }),
    ]);
    if (positions.length === 0) return finish("Elegí tus puestos deseados en Mi perfil para poder buscar.");
    if (!activeCv) return finish("Cargá tu CV en Mi perfil para poder calcular qué ofertas te encajan.");

    const desired = new Set(positions.map((position) => position.title));
    const terms = positions.map((position) => position.title);

    // 1. Traer ofertas de todas las fuentes elegidas; si una falla, las demás siguen
    const aggregators = settings.sources.filter((source): source is AggregatorSource =>
        (AGGREGATOR_SOURCES as readonly string[]).includes(source)
    );
    const boards = settings.atsBoards.map(parseAtsBoard).filter((board) => board !== null);
    const requests = [
        ...aggregators.map((source) => ({
            label: source,
            // Los que buscan por puesto se cachean por lista de puestos; los demás devuelven lo último publicado
            load: () =>
                cached(cache, SEARCH_BY_TERM_SOURCES.has(source) ? `${source}|${terms.join("|")}` : source, () =>
                    fetchAggregator(source, terms)
                ),
        })),
        ...boards.map(({ source, board }) => ({
            label: `${source}:${board}`,
            load: () => cached(cache, `${source}:${board}`, () => fetchAtsBoard(source, board)),
        })),
    ];
    if (requests.length === 0) return finish("No hay fuentes activas.");

    const sourceStats = (label: string) => (result.bySource[label] ??= emptySourceStats());
    const fetched = await Promise.all(
        requests.map(async (request) => {
            const stats = sourceStats(request.label);
            try {
                return await request.load();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                stats.error = message;
                result.errors.push(`${request.label}: ${message}`);
                return [];
            }
        })
    );

    const unique = new Map<string, IngestedJob>();
    for (const job of fetched.flat()) if (!unique.has(ingestKey(job))) unique.set(ingestKey(job), job);
    result.fetched = unique.size;

    // 2. Descartar lo que ya está en la cuenta (por id de la fuente o por link)
    const jobs = Array.from(unique.values());
    const existing = await prisma.jobApplication.findMany({
        where: {
            profileId,
            OR: [{ externalId: { in: jobs.map(ingestKey) } }, { link: { in: jobs.map((job) => job.url) } }],
        },
        select: { externalId: true, link: true },
    });
    const seen = new Set(existing.flatMap((app) => [app.externalId, app.link].filter(Boolean)));

    const cvKeywordIds = (
        await prisma.cVKeyword.findMany({ where: { cvId: activeCv.id }, select: { keywordId: true } })
    ).map((keyword) => keyword.keywordId);
    const cvKeywordSet = new Set(cvKeywordIds);

    // 3. Filtrar por puesto deseado, por los filtros y por score; lo que pasa entra a la cola
    const rules = toRules(settings);
    let passed = 0;
    let queueFull = false;
    const statsOf = (job: IngestedJob) => {
        const { source, board } = sourceOf(job);
        return sourceStats(board ? `${source}:${board}` : source);
    };
    // Cada oferta que llegó queda anotada, entre o no a la cola
    const record = (
        job: IngestedJob,
        offer: Omit<IngestedOfferInput, "externalId" | "source" | "board" | "title" | "company" | "location" | "url">
    ) => {
        const { source, board } = sourceOf(job);
        result.offers.push({
            externalId: ingestKey(job),
            source,
            board,
            title: job.title,
            company: job.company,
            location: job.location,
            url: job.url,
            ...offer,
        });
        const stats = statsOf(job);
        if (offer.decision === "REJECTED") stats.rejected++;
        if (offer.decision === "QUEUED" || offer.decision === "PASSES") stats.passed++;
    };
    const decide = (
        job: IngestedJob,
        role: Pick<IngestedOfferInput, "roleName" | "seniority">,
        decision: Pick<SearchDecision, "status" | "reason" | "score" | "summary">
    ) => {
        record(job, { ...role, decision: decision.status, reason: decision.reason, score: decision.score });
        if (decision.status === "REJECTED") result.filtered++;
        else passed++;
        if (result.decisions.length < MAX_DECISIONS) {
            result.decisions.push({
                externalId: ingestKey(job),
                title: job.title,
                company: job.company,
                location: job.location,
                url: job.url,
                ...decision,
            });
        }
    };

    for (const job of jobs) {
        statsOf(job).fetched++;
        if (seen.has(ingestKey(job)) || seen.has(job.url)) {
            record(job, { roleName: null, seniority: null, decision: "IN_ACCOUNT", reason: null, score: null });
            continue;
        }
        result.fresh++;
        statsOf(job).fresh++;

        const { roleName, seniority } = await classifyJobTitle(job.title);
        if (!roleName || !desired.has(roleName)) {
            record(job, { roleName, seniority, decision: "OTHER_ROLE", reason: null, score: null });
            continue;
        }
        result.matchedRole++;
        statsOf(job).matchedRole++;
        const role = { roleName, seniority };

        const description = job.description.slice(0, LIMITS.jobDescription);
        const eligibility = checkEligibility(
            { source: job.source, title: job.title, location: job.location, description, seniority, salaryUsdMonthly: job.salaryUsdMonthly },
            rules
        );
        if (eligibility.blockers.length) {
            decide(job, role, { status: "REJECTED", reason: eligibility.blockers.join(" · "), score: null, summary: eligibility.summary });
            continue;
        }

        // "Golang Kubernetes Engineer" puede dar match alto con una descripción corta: el título manda
        const titleStack = (await detectKeywords(job.title)).filter((keyword) => STACK_CATEGORIES.has(keyword.category));
        if (titleStack.length && !titleStack.some((keyword) => cvKeywordSet.has(keyword.id))) {
            const reason = `El título pide ${titleStack.map((keyword) => keyword.name).join(", ")}`;
            decide(job, role, { status: "REJECTED", reason, score: null, summary: eligibility.summary });
            continue;
        }

        const keywords = await detectKeywords(description);
        const score = computeMatchScore(keywords.map((keyword) => keyword.id), cvKeywordIds);
        if (score === null || score < eligibility.minScore) {
            const reason = score === null ? "Sin keywords para comparar con el CV" : `Match ${score}% (mínimo ${eligibility.minScore}%)`;
            decide(job, role, { status: "REJECTED", reason, score, summary: eligibility.summary });
            continue;
        }

        if (opts.dryRun) {
            decide(job, role, { status: "PASSES", reason: null, score, summary: eligibility.summary });
            continue;
        }

        // Con la cola llena se sigue evaluando: lo que pasa queda anotado y entra en la próxima búsqueda
        if (result.created >= settings.maxPerRun) queueFull = true;
        if (queueFull) {
            result.deferred++;
            decide(job, role, { status: "PASSES", reason: null, score, summary: eligibility.summary });
            continue;
        }

        const created = await createApplicationForProfile(profileId, {
            jobTitle: job.title,
            jobDescription: description,
            link: job.url,
            applyUrl: job.applyUrl ?? undefined,
            company: job.company ?? undefined,
            source: job.source,
            externalId: ingestKey(job),
            applyMode: applyModeForUrl(job.applyUrl ?? job.url),
            status: "READY",
            score,
            notes: [eligibility.summary, `match ${score}%`].filter(Boolean).join(" · "),
            positionTitle: roleName,
            detectedWords: [],
        });
        if (!created.ok) {
            if (created.code === "LIMIT_REACHED") {
                result.errors.push(created.message);
                queueFull = true;
                result.deferred++;
                decide(job, role, { status: "PASSES", reason: null, score, summary: eligibility.summary });
                continue;
            }
            // No se pudo crear: como no quedó en la cuenta, se vuelve a intentar en la próxima búsqueda
            record(job, { ...role, decision: "PASSES", reason: null, score });
            continue;
        }
        result.created++;
        decide(job, role, { status: "QUEUED", reason: null, score, summary: eligibility.summary });
    }

    const outcome = opts.dryRun ? `${passed} entrarían a la cola` : `${result.created} nuevas en la cola`;
    return finish(
        `${result.fetched} ofertas revisadas, ${result.matchedRole} de tus puestos, ${result.filtered} descartadas por los filtros, ${outcome}.` +
            (result.errors.length ? ` Fallaron: ${result.errors.map((error) => error.split(":")[0]).join(", ")}.` : "") +
            (result.deferred === 1 ? " 1 más pasa los filtros y entra en la próxima búsqueda." : "") +
            (result.deferred > 1 ? ` ${result.deferred} más pasan los filtros y entran en la próxima búsqueda.` : "")
    );
}

/** Corre la búsqueda y guarda cuándo fue, qué encontró y qué trajo cada portal, para mostrarlo en la app. */
export async function runAndRecord(
    profileId: string,
    settings: SearchSettingsInput,
    cache?: FetchCache,
    trigger: RunTrigger = "CRON"
): Promise<SearchRunResult> {
    const startedAt = Date.now();
    const result = await runJobSearch(profileId, settings, cache);
    const durationMs = Date.now() - startedAt;
    if (result.errors.length) console.warn(`Job search for ${profileId}:`, result.errors);
    await prisma.jobSearchSettings.update({
        where: { profileId },
        data: { lastRunAt: new Date(), lastResult: result.summary },
    });
    // Las estadísticas nunca rompen la búsqueda: las ofertas ya están en la cola
    try {
        await saveSearchRun(profileId, trigger, result, durationMs);
    } catch (error) {
        console.error("Search stats not saved:", error);
    }
    return result;
}

// Buscar a mano también consulta APIs ajenas: como mucho una vez por hora
const MANUAL_RUN_INTERVAL_MS = 60 * 60 * 1000;

/** Corre ahora la búsqueda guardada del perfil, como mucho una vez por hora. La usan "Buscar ahora" y el agente. */
export async function runSavedSearch(
    profileId: string,
    trigger: RunTrigger
): Promise<ActionResult<{ summary: string; created: number }>> {
    const settings = await prisma.jobSearchSettings.findUnique({ where: { profileId } });
    if (!settings) return { ok: false, code: "NOT_CONFIGURED", message: "Guardá la configuración de la búsqueda antes de buscar." };

    const elapsed = settings.lastRunAt ? Date.now() - settings.lastRunAt.getTime() : Infinity;
    if (elapsed < MANUAL_RUN_INTERVAL_MS) {
        const minutes = Math.ceil((MANUAL_RUN_INTERVAL_MS - elapsed) / 60_000);
        return { ok: false, code: "TOO_SOON", message: `Ya se buscó hace poco. Podés volver a buscar en ${minutes} min.` };
    }

    const result = await runAndRecord(profileId, settings, undefined, trigger);
    return { ok: true, data: { summary: result.summary, created: result.created } };
}
