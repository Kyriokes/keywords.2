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
    matchedRole: number;
    /** Ofertas de tus puestos descartadas por los filtros o por el match con el CV. */
    filtered: number;
    created: number;
    decisions: SearchDecision[];
    errors: string[];
    summary: string;
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
    const result: SearchRunResult = { fetched: 0, matchedRole: 0, filtered: 0, created: 0, decisions: [], errors: [], summary: "" };
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

    const fetched = await Promise.all(
        requests.map(async (request) => {
            try {
                return await request.load();
            } catch (error) {
                result.errors.push(`${request.label}: ${error instanceof Error ? error.message : String(error)}`);
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
    const decide = (job: IngestedJob, decision: Pick<SearchDecision, "status" | "reason" | "score" | "summary">) => {
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
        if (!opts.dryRun && result.created >= settings.maxPerRun) break;
        if (seen.has(ingestKey(job)) || seen.has(job.url)) continue;

        const { roleName, seniority } = await classifyJobTitle(job.title);
        if (!roleName || !desired.has(roleName)) continue;
        result.matchedRole++;

        const description = job.description.slice(0, LIMITS.jobDescription);
        const eligibility = checkEligibility(
            { source: job.source, title: job.title, location: job.location, description, seniority, salaryUsdMonthly: job.salaryUsdMonthly },
            rules
        );
        if (eligibility.blockers.length) {
            decide(job, { status: "REJECTED", reason: eligibility.blockers.join(" · "), score: null, summary: eligibility.summary });
            continue;
        }

        // "Golang Kubernetes Engineer" puede dar match alto con una descripción corta: el título manda
        const titleStack = (await detectKeywords(job.title)).filter((keyword) => STACK_CATEGORIES.has(keyword.category));
        if (titleStack.length && !titleStack.some((keyword) => cvKeywordSet.has(keyword.id))) {
            const reason = `El título pide ${titleStack.map((keyword) => keyword.name).join(", ")}`;
            decide(job, { status: "REJECTED", reason, score: null, summary: eligibility.summary });
            continue;
        }

        const keywords = await detectKeywords(description);
        const score = computeMatchScore(keywords.map((keyword) => keyword.id), cvKeywordIds);
        if (score === null || score < eligibility.minScore) {
            const reason = score === null ? "Sin keywords para comparar con el CV" : `Match ${score}% (mínimo ${eligibility.minScore}%)`;
            decide(job, { status: "REJECTED", reason, score, summary: eligibility.summary });
            continue;
        }

        if (opts.dryRun) {
            decide(job, { status: "PASSES", reason: null, score, summary: eligibility.summary });
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
                break;
            }
            continue;
        }
        result.created++;
        decide(job, { status: "QUEUED", reason: null, score, summary: eligibility.summary });
    }

    const outcome = opts.dryRun ? `${passed} entrarían a la cola` : `${result.created} nuevas en la cola`;
    return finish(
        `${result.fetched} ofertas revisadas, ${result.matchedRole} de tus puestos, ${result.filtered} descartadas por los filtros, ${outcome}.` +
            (result.errors.length ? ` Fallaron: ${result.errors.map((error) => error.split(":")[0]).join(", ")}.` : "")
    );
}

/** Corre la búsqueda y guarda cuándo fue y qué encontró, para mostrarlo en la app. */
export async function runAndRecord(profileId: string, settings: SearchSettingsInput, cache?: FetchCache) {
    const result = await runJobSearch(profileId, settings, cache);
    if (result.errors.length) console.warn(`Job search for ${profileId}:`, result.errors);
    await prisma.jobSearchSettings.update({
        where: { profileId },
        data: { lastRunAt: new Date(), lastResult: result.summary },
    });
    return result;
}

// Buscar a mano también consulta APIs ajenas: como mucho una vez por hora
const MANUAL_RUN_INTERVAL_MS = 60 * 60 * 1000;

/** Corre ahora la búsqueda guardada del perfil, como mucho una vez por hora. La usan "Buscar ahora" y el agente. */
export async function runSavedSearch(profileId: string): Promise<ActionResult<{ summary: string; created: number }>> {
    const settings = await prisma.jobSearchSettings.findUnique({ where: { profileId } });
    if (!settings) return { ok: false, code: "NOT_CONFIGURED", message: "Guardá la configuración de la búsqueda antes de buscar." };

    const elapsed = settings.lastRunAt ? Date.now() - settings.lastRunAt.getTime() : Infinity;
    if (elapsed < MANUAL_RUN_INTERVAL_MS) {
        const minutes = Math.ceil((MANUAL_RUN_INTERVAL_MS - elapsed) / 60_000);
        return { ok: false, code: "TOO_SOON", message: `Ya se buscó hace poco. Podés volver a buscar en ${minutes} min.` };
    }

    const result = await runAndRecord(profileId, settings);
    return { ok: true, data: { summary: result.summary, created: result.created } };
}
