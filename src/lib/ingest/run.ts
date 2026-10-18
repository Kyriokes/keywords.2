import "server-only";

import prisma from "@/lib/prisma";
import { createApplicationForProfile } from "@/lib/applications/create";
import { computeMatchScore } from "@/lib/applications/prepare";
import { detectKeywords } from "@/lib/keywords/dictionary";
import { classifyJobTitle } from "@/lib/positions/dictionary";
import { LIMITS } from "@/lib/validation";
import {
    AGGREGATOR_SOURCES,
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
}

export interface SearchRunResult {
    fetched: number;
    matchedRole: number;
    created: number;
    errors: string[];
    summary: string;
}

const ingestKey = (job: IngestedJob) => `${job.source}:${job.externalId}`;

function cached(cache: FetchCache, key: string, load: () => Promise<IngestedJob[]>): Promise<IngestedJob[]> {
    let pending = cache.get(key);
    if (!pending) {
        pending = load();
        cache.set(key, pending);
    }
    return pending;
}

/** Busca ofertas para un perfil y deja en la cola (READY) las que encajan con sus puestos y su CV. */
export async function runJobSearch(
    profileId: string,
    settings: SearchSettingsInput,
    cache: FetchCache = new Map()
): Promise<SearchRunResult> {
    const result: SearchRunResult = { fetched: 0, matchedRole: 0, created: 0, errors: [], summary: "" };
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
            // Get on Board busca por término; los demás devuelven lo último publicado
            load: () => cached(cache, source === "getonbrd" ? `${source}|${terms.join("|")}` : source, () => fetchAggregator(source, terms)),
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

    // 3. Filtrar por puesto deseado y por score; lo que pasa entra a la cola
    for (const job of jobs) {
        if (result.created >= settings.maxPerRun) break;
        if (seen.has(ingestKey(job)) || seen.has(job.url)) continue;

        const { roleName } = await classifyJobTitle(job.title);
        if (!roleName || !desired.has(roleName)) continue;
        result.matchedRole++;

        const description = job.description.slice(0, LIMITS.jobDescription);
        const keywords = await detectKeywords(description);
        const score = computeMatchScore(keywords.map((keyword) => keyword.id), cvKeywordIds);
        if (score === null || score < settings.minScore) continue;

        const created = await createApplicationForProfile(profileId, {
            jobTitle: job.title,
            jobDescription: description,
            link: job.url,
            applyUrl: job.applyUrl ?? undefined,
            company: job.company ?? undefined,
            source: job.source,
            externalId: ingestKey(job),
            applyMode: "EXTERNAL_FORM",
            status: "READY",
            score,
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
    }

    return finish(
        `${result.fetched} ofertas revisadas, ${result.matchedRole} de tus puestos, ${result.created} nuevas en la cola.` +
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
