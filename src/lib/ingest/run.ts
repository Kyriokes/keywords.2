import "server-only";

import prisma from "@/lib/prisma";
import { applyModeForUrl } from "@/lib/applications/applyMode";
import { createApplicationForProfile } from "@/lib/applications/create";
import { appendNote } from "@/lib/applications/notes";
import { computeMatchScore } from "@/lib/applications/prepare";
import { skipApplications } from "@/lib/applications/skip";
import { detectKeywords } from "@/lib/keywords/dictionary";
import { classifyJobTitle } from "@/lib/positions/dictionary";
import { normalizePreferenceKey } from "@/lib/preferences/kinds";
import { loadPreferenceRules, type PreferenceRules } from "@/lib/preferences/preferences";
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
    ATS_SOURCES,
    SEARCH_BY_TERM_SOURCES,
    fetchAggregator,
    fetchAtsBoard,
    parseAtsBoard,
    type AggregatorSource,
    type AtsSource,
    type IngestedJob,
} from "./sources";
import { saveSearchRun } from "./record";
import { requirementsSection } from "./stack";
import { emptySourceStats, sourceLabel, sourceOf, type IngestedOfferInput, type RunTrigger, type SourceStats } from "./stats";
import { buildNotes } from "./summary";

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
    /** Match desde el que una oferta sin advertencias y con formulario externo entra aprobada; null = nunca. */
    autoApproveMinScore?: number | null;
    /** Sueldo mínimo (USD por mes): una oferta que publica menos se descarta; null = no mirar. */
    minSalaryUsdMonthly?: number | null;
    /** Ofertas de la misma empresa que pueden entrar en 30 días. */
    maxPerCompanyPerMonth?: number;
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
    /** Entró (o entraría) aprobada sin pasar por la cola. */
    autoApproved?: boolean;
}

export interface SearchRunResult {
    fetched: number;
    /** Las que no estaban en la cuenta. */
    fresh: number;
    matchedRole: number;
    /** Ofertas de tus puestos descartadas por los filtros o por el match con el CV. */
    filtered: number;
    created: number;
    /** De las creadas, las que entraron aprobadas sin pasar por la cola. */
    autoApproved: number;
    /** Pasan los filtros pero la cola ya estaba llena: entran en la próxima búsqueda. */
    deferred: number;
    /** Ofertas de la cuenta que ya no están publicadas en su ATS y se descartaron. */
    closed: number;
    /** Ofertas de la cuenta a las que se les sumó el formulario directo porque llegaron de nuevo desde su ATS. */
    enriched: number;
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
/** Con menos tecnologías en los requisitos no se puede decir que el stack es otro. */
const MIN_REQUIRED_STACK = 2;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Ventana en la que una oferta de la misma empresa y el mismo título cuenta como repetida. */
const DUPLICATE_WINDOW_DAYS = 45;
/** Ventana del tope de ofertas por empresa. */
const COMPANY_WINDOW_DAYS = 30;
/** Estados que cuentan para el tope por empresa: lo que ya está en la cola o se envió. */
const COUNTED_STATUSES = new Set(["READY", "APPROVED", "NEEDS_USER", "APPLIED", "INTERVIEW"]);
/** Estados en los que una oferta repetida puede recibir el formulario directo, o darse por cerrada. */
const OPEN_STATUSES = ["READY", "APPROVED"] as const;
const DEFAULT_MAX_PER_COMPANY = 2;

const ingestKey = (job: IngestedJob) => `${job.source}:${job.externalId}`;
const companyKeyOf = (company: string | null | undefined) => (company?.trim() ? normalizePreferenceKey(company) : null);
const isAtsSource = (source: string): source is AtsSource => (ATS_SOURCES as readonly string[]).includes(source);

/** Reglas de los filtros a partir de lo guardado; un valor desconocido vuelve al de por defecto. */
function toRules(settings: SearchSettingsInput, preferences: PreferenceRules): EligibilityRules {
    const workModes = settings.workModes.filter((mode): mode is WorkMode => (WORK_MODES as readonly string[]).includes(mode));
    const seniorityPolicy = (SENIORITY_POLICIES as readonly string[]).includes(settings.seniorityPolicy)
        ? (settings.seniorityPolicy as SeniorityPolicy)
        : "FLEXIBLE";
    return {
        workModes: workModes.length ? workModes : DEFAULT_WORK_MODES,
        seniorityPolicy,
        minScore: settings.minScore,
        minRelocationSalaryUsd: settings.minRelocationSalaryUsd,
        minSalaryUsdMonthly: settings.minSalaryUsdMonthly ?? null,
        avoidPhrases: preferences.avoidPhrases,
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

/** Una postulación reciente de la cuenta, para detectar repetidas y contar por empresa. */
interface RecentApplication {
    id: string;
    source: string | null;
    status: string;
    applyUrl: string | null;
    company: string | null;
    jobTitle: string;
    date: Date;
}

/** La misma búsqueda publicada en dos portales: misma empresa y mismo título sin nivel ni ruido. */
const duplicateKey = (companyKey: string, core: string) => `${companyKey}|${core}`;

/**
 * Busca ofertas para un perfil y deja en la cola (READY) las que encajan con sus puestos y su CV
 * y pasan los filtros. Con `dryRun` no guarda nada: cuenta qué entraría y por qué se descarta el resto.
 */
export async function runJobSearch(
    profileId: string,
    settings: SearchSettingsInput,
    cache: FetchCache = new Map(),
    opts: { dryRun?: boolean; now?: Date } = {}
): Promise<SearchRunResult> {
    const now = opts.now ?? new Date();
    const result: SearchRunResult = {
        fetched: 0,
        fresh: 0,
        matchedRole: 0,
        filtered: 0,
        created: 0,
        autoApproved: 0,
        deferred: 0,
        closed: 0,
        enriched: 0,
        decisions: [],
        errors: [],
        summary: "",
        offers: [],
        bySource: {},
    };
    const finish = (summary: string) => ({ ...result, summary });

    const [positions, activeCv, preferences] = await Promise.all([
        prisma.position.findMany({ where: { profileId }, select: { title: true } }),
        prisma.cV.findFirst({ where: { profileId, isPrimary: true }, select: { id: true } }),
        loadPreferenceRules(profileId),
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

    // 2. Lo que ya está en la cuenta (por id de la fuente o por link) y lo reciente, para detectar repetidas
    //    entre portales y contar cuántas ofertas de cada empresa ya entraron
    const jobs = Array.from(unique.values());
    const [existing, recent] = await Promise.all([
        prisma.jobApplication.findMany({
            where: {
                profileId,
                OR: [{ externalId: { in: jobs.map(ingestKey) } }, { link: { in: jobs.map((job) => job.url) } }],
            },
            select: { externalId: true, link: true },
        }),
        prisma.jobApplication.findMany({
            where: { profileId, date: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * DAY_MS) } },
            select: { id: true, source: true, status: true, applyUrl: true, company: true, jobTitle: true, date: true },
        }),
    ]);
    const seen = new Set(existing.flatMap((app) => [app.externalId, app.link].filter(Boolean)));

    const companyCounts = new Map<string, number>();
    const recentIndex = new Map<string, Pick<RecentApplication, "id" | "source" | "status" | "applyUrl">>();
    const companySince = now.getTime() - COMPANY_WINDOW_DAYS * DAY_MS;
    for (const app of recent as RecentApplication[]) {
        const companyKey = companyKeyOf(app.company);
        if (!companyKey || !app.jobTitle) continue;
        if (COUNTED_STATUSES.has(app.status) && app.date && app.date.getTime() >= companySince) {
            companyCounts.set(companyKey, (companyCounts.get(companyKey) ?? 0) + 1);
        }
        const { core } = await classifyJobTitle(app.jobTitle);
        const key = duplicateKey(companyKey, core);
        if (!recentIndex.has(key)) recentIndex.set(key, app);
    }
    const maxPerCompany = settings.maxPerCompanyPerMonth ?? DEFAULT_MAX_PER_COMPANY;

    const cvKeywordIds = (
        await prisma.cVKeyword.findMany({ where: { cvId: activeCv.id }, select: { keywordId: true } })
    ).map((keyword) => keyword.keywordId);
    const cvKeywordSet = new Set(cvKeywordIds);

    // 3. Filtrar por puesto deseado, por los filtros y por score; lo que pasa entra a la cola
    const rules = toRules(settings, preferences);
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
        decision: Pick<SearchDecision, "status" | "reason" | "score" | "summary" | "autoApproved">
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

        const { roleName, seniority: titleSeniority, core } = await classifyJobTitle(job.title);
        const companyKey = companyKeyOf(job.company);

        // La misma búsqueda ya llegó por otro portal: no se duplica. Si la que está no tiene el formulario y
        // esta viene del ATS de la empresa, se le suma el link directo.
        const duplicate = companyKey ? recentIndex.get(duplicateKey(companyKey, core)) : undefined;
        if (duplicate) {
            record(job, {
                roleName,
                seniority: titleSeniority,
                decision: "IN_ACCOUNT",
                reason: `Repetida: ya está desde ${sourceLabel(duplicate.source)}`,
                score: null,
            });
            const canEnrich = (OPEN_STATUSES as readonly string[]).includes(duplicate.status) && !duplicate.applyUrl && isAtsSource(job.source) && job.applyUrl;
            if (canEnrich && !opts.dryRun) {
                const current = await prisma.jobApplication.findUnique({ where: { id: duplicate.id }, select: { notes: true } });
                await prisma.jobApplication.update({
                    where: { id: duplicate.id },
                    data: {
                        applyUrl: job.applyUrl,
                        notes: appendNote(current?.notes, `Formulario directo encontrado en ${sourceLabel(job.source)}`),
                    },
                });
                duplicate.applyUrl = job.applyUrl;
                result.enriched++;
            }
            continue;
        }

        result.fresh++;
        statsOf(job).fresh++;

        if (!roleName || !desired.has(roleName)) {
            record(job, { roleName, seniority: titleSeniority, decision: "OTHER_ROLE", reason: null, score: null });
            continue;
        }
        result.matchedRole++;
        statsOf(job).matchedRole++;

        const description = job.description.slice(0, LIMITS.jobDescription);
        const eligibility = checkEligibility(
            {
                source: job.source,
                title: job.title,
                location: job.location,
                description,
                seniority: titleSeniority,
                seniorityHint: job.seniorityHint,
                salaryUsdMonthly: job.salaryUsdMonthly,
                salaryMaxUsdMonthly: job.salaryMaxUsdMonthly,
            },
            rules
        );
        const role = { roleName, seniority: eligibility.seniority ?? titleSeniority };
        const reject = (reason: string, score: number | null = null) =>
            decide(job, role, { status: "REJECTED", reason, score, summary: eligibility.summary });

        if (companyKey && preferences.avoidCompanyKeys.has(companyKey)) {
            reject(`Evitás ${job.company}`);
            continue;
        }
        const perCompany = companyKey ? companyCounts.get(companyKey) ?? 0 : 0;
        if (companyKey && perCompany >= maxPerCompany) {
            reject(`Ya tenés ${perCompany} ofertas de ${job.company} este mes`);
            continue;
        }

        if (eligibility.blockers.length) {
            reject(eligibility.blockers.join(" · "));
            continue;
        }

        // "Golang Kubernetes Engineer" puede dar match alto con una descripción corta: el título manda
        const titleStack = (await detectKeywords(job.title)).filter((keyword) => STACK_CATEGORIES.has(keyword.category));
        if (titleStack.length && !titleStack.some((keyword) => cvKeywordSet.has(keyword.id))) {
            reject(`El título pide ${titleStack.map((keyword) => keyword.name).join(", ")}`);
            continue;
        }

        // Lo que la sección de requisitos nombra es lo que de verdad piden: si ninguna está en el CV, es otro stack
        const section = requirementsSection(description);
        const requiredStack = section ? (await detectKeywords(section)).filter((keyword) => STACK_CATEGORIES.has(keyword.category)) : [];
        const avoidedTech = [...titleStack, ...requiredStack].find((keyword) => preferences.avoidTechKeywordIds.has(keyword.id));
        if (avoidedTech) {
            reject(`Evitás ${avoidedTech.name}`);
            continue;
        }
        if (requiredStack.length >= MIN_REQUIRED_STACK && !requiredStack.some((keyword) => cvKeywordSet.has(keyword.id))) {
            reject(`Los requisitos piden ${requiredStack.slice(0, 4).map((keyword) => keyword.name).join(", ")}`);
            continue;
        }

        const keywords = await detectKeywords(description);
        const score = computeMatchScore(keywords, cvKeywordIds);
        if (score === null || score < eligibility.minScore) {
            reject(score === null ? "Sin keywords para comparar con el CV" : `Match ${score}% (mínimo ${eligibility.minScore}%)`, score);
            continue;
        }

        const applyMode = applyModeForUrl(job.applyUrl ?? job.url);
        const autoApprove =
            settings.autoApproveMinScore != null &&
            score >= settings.autoApproveMinScore &&
            applyMode === "EXTERNAL_FORM" &&
            eligibility.warnings.length === 0;
        const passes = { status: "PASSES" as const, reason: null, score, summary: eligibility.summary, autoApproved: autoApprove };

        if (opts.dryRun) {
            decide(job, role, passes);
            if (companyKey) companyCounts.set(companyKey, perCompany + 1);
            continue;
        }

        // Con la cola llena se sigue evaluando: lo que pasa queda anotado y entra en la próxima búsqueda
        if (result.created >= settings.maxPerRun) queueFull = true;
        if (queueFull) {
            result.deferred++;
            decide(job, role, passes);
            continue;
        }

        // Las tecnologías del stack que faltan, de más a menos mencionadas: con eso se decide sin abrir la oferta
        const missing = keywords
            .filter((keyword) => STACK_CATEGORIES.has(keyword.category) && !cvKeywordSet.has(keyword.id))
            .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
            .map((keyword) => keyword.name);
        const created = await createApplicationForProfile(profileId, {
            jobTitle: job.title,
            jobDescription: description,
            link: job.url,
            applyUrl: job.applyUrl ?? undefined,
            company: job.company ?? undefined,
            source: job.source,
            externalId: ingestKey(job),
            applyMode,
            status: autoApprove ? "APPROVED" : "READY",
            score,
            seniority: eligibility.seniority ?? undefined,
            notes: buildNotes({ summary: eligibility.summary, publishedAt: job.publishedAt, score, missing, warnings: eligibility.warnings }, now),
            positionTitle: roleName,
            detectedWords: [],
        });
        if (!created.ok) {
            if (created.code === "LIMIT_REACHED") {
                result.errors.push(created.message);
                queueFull = true;
                result.deferred++;
                decide(job, role, passes);
                continue;
            }
            // No se pudo crear: como no quedó en la cuenta, se vuelve a intentar en la próxima búsqueda
            record(job, { ...role, decision: "PASSES", reason: null, score });
            continue;
        }
        result.created++;
        if (autoApprove) result.autoApproved++;
        if (companyKey) {
            companyCounts.set(companyKey, perCompany + 1);
            // Si la misma búsqueda llega por otro portal en esta corrida, ya cuenta como repetida
            recentIndex.set(duplicateKey(companyKey, core), {
                id: created.data.application.id,
                source: job.source,
                status: autoApprove ? "APPROVED" : "READY",
                applyUrl: job.applyUrl,
            });
        }
        decide(job, role, { status: "QUEUED", reason: null, score, summary: eligibility.summary, autoApproved: autoApprove });
    }

    // 4. Las ofertas que seguíamos en un ATS y ya no aparecen en él están cerradas
    if (!opts.dryRun) result.closed = await closeMissingBoardOffers(profileId, boards, result.bySource, unique);

    const outcome = opts.dryRun ? `${passed} entrarían a la cola` : `${result.created} nuevas en la cola`;
    const autoApproved = result.autoApproved
        ? ` (${result.autoApproved} ${result.autoApproved === 1 ? "aprobada sola" : "aprobadas solas"})`
        : "";
    return finish(
        `${result.fetched} ofertas revisadas, ${result.matchedRole} de tus puestos, ${result.filtered} descartadas por los filtros, ${outcome}${autoApproved}.` +
            (result.errors.length ? ` Fallaron: ${result.errors.map((error) => error.split(":")[0]).join(", ")}.` : "") +
            (result.deferred === 1 ? " 1 más pasa los filtros y entra en la próxima búsqueda." : "") +
            (result.deferred > 1 ? ` ${result.deferred} más pasan los filtros y entran en la próxima búsqueda.` : "") +
            (result.closed === 1 ? " 1 oferta que seguías ya no está publicada y se descartó." : "") +
            (result.closed > 1 ? ` ${result.closed} ofertas que seguías ya no están publicadas y se descartaron.` : "")
    );
}

/**
 * Descarta (CLOSED) las ofertas READY/APPROVED que vinieron de un ATS que respondió bien en esta búsqueda y ya
 * no las publica. Si el board falló, no se toca nada: no se sabe si la oferta sigue.
 */
async function closeMissingBoardOffers(
    profileId: string,
    boards: { source: AtsSource; board: string }[],
    bySource: Record<string, SourceStats>,
    fetched: Map<string, IngestedJob>
): Promise<number> {
    const healthy = boards.filter(({ source, board }) => !bySource[`${source}:${board}`]?.error);
    if (healthy.length === 0) return 0;

    const open = await prisma.jobApplication.findMany({
        where: {
            profileId,
            status: { in: [...OPEN_STATUSES] },
            OR: healthy.map(({ source, board }) => ({ externalId: { startsWith: `${source}:${board}:` } })),
        },
        select: { id: true, externalId: true },
    });
    const stale = open.filter((app) => app.externalId && !fetched.has(app.externalId));
    if (stale.length === 0) return 0;

    const { skipped } = await skipApplications(
        profileId,
        stale.map((app) => ({
            id: app.id,
            reason: "CLOSED" as const,
            detail: `Ya no está publicada en ${sourceLabel(app.externalId!.split(":")[0])}`,
        })),
        OPEN_STATUSES
    );
    return skipped.length;
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

    // La corrida se reserva en la base antes de empezar: si llegan dos pedidos juntos (dos clics, o el agente
    // repitiendo la llamada), uno solo busca. Sin esto los dos creaban las mismas ofertas en la cola.
    const now = Date.now();
    const claimed = await prisma.jobSearchSettings.updateMany({
        where: { profileId, OR: [{ lastRunAt: null }, { lastRunAt: { lt: new Date(now - MANUAL_RUN_INTERVAL_MS) } }] },
        data: { lastRunAt: new Date(now) },
    });
    if (claimed.count === 0) {
        // Si la última que leímos ya era vieja, otro pedido acaba de reservarla: falta la hora entera
        const elapsed = settings.lastRunAt ? now - settings.lastRunAt.getTime() : Infinity;
        const remaining = elapsed < MANUAL_RUN_INTERVAL_MS ? MANUAL_RUN_INTERVAL_MS - elapsed : MANUAL_RUN_INTERVAL_MS;
        const minutes = Math.max(1, Math.ceil(remaining / 60_000));
        return { ok: false, code: "TOO_SOON", message: `Ya se buscó hace poco. Podés volver a buscar en ${minutes} min.` };
    }

    try {
        const result = await runAndRecord(profileId, settings, undefined, trigger);
        return { ok: true, data: { summary: result.summary, created: result.created } };
    } catch (error) {
        // Si la búsqueda no llegó a terminar, la reserva se devuelve para poder reintentar enseguida
        await prisma.jobSearchSettings
            .updateMany({ where: { profileId }, data: { lastRunAt: settings.lastRunAt } })
            .catch((restoreError) => console.error("Search claim not released:", restoreError));
        throw error;
    }
}
