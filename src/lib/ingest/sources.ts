/**
 * Fuentes de ofertas con API pública. Cada una convierte su respuesta a `IngestedJob`.
 * Los parsers son puros (se testean con respuestas reales); `fetchSource` hace los pedidos.
 * Se usan las APIs abiertas que los portales ofrecen para esto. La excepción es Computrabajo, que no
 * tiene API: se leen sus páginas públicas de resultados, pocas por búsqueda (ver ./computrabajo.ts).
 */

import type { Seniority } from "@/lib/positions/rules";
import { fetchComputrabajo } from "./computrabajo";
import { htmlToText } from "./html";

export interface IngestedJob {
    source: string;
    externalId: string;
    title: string;
    company: string | null;
    /** Publicación de la oferta. */
    url: string;
    /** Formulario de postulación, si el portal lo da aparte. */
    applyUrl: string | null;
    description: string;
    location: string | null;
    /** Sueldo mínimo publicado, en USD por mes; sin valor si no se publica o está en otra moneda. */
    salaryUsdMonthly?: number;
    /** Máximo del rango publicado, en USD por mes. */
    salaryMaxUsdMonthly?: number;
    /** Cuándo se publicó (ISO), si el portal lo dice. */
    publishedAt?: string;
    /** Nivel que informa el portal, para cuando el título no lo dice. */
    seniorityHint?: Seniority | null;
}

/** Portales que agregan ofertas de muchas empresas: se consultan una vez por búsqueda. */
export const AGGREGATOR_SOURCES = ["remotive", "remoteok", "himalayas", "getonbrd", "jobicy", "computrabajo"] as const;
/** Portales que se consultan por cada puesto deseado, no una sola vez para todos. */
export const SEARCH_BY_TERM_SOURCES = new Set<string>(["himalayas", "getonbrd", "computrabajo"]);
/** ATS de empresas: se consultan por cada empresa que siga el usuario ("greenhouse:stripe"). */
export const ATS_SOURCES = ["greenhouse", "lever", "ashby", "workable", "smartrecruiters"] as const;

export type AggregatorSource = typeof AGGREGATOR_SOURCES[number];
export type AtsSource = typeof ATS_SOURCES[number];

export const SOURCE_LABELS: Record<AggregatorSource | AtsSource, string> = {
    remotive: "Remotive (remoto)",
    remoteok: "Remote OK (remoto)",
    himalayas: "Himalayas (remoto)",
    getonbrd: "Get on Board (LatAm)",
    jobicy: "Jobicy (remoto, LatAm)",
    computrabajo: "Computrabajo (Argentina)",
    greenhouse: "Greenhouse",
    lever: "Lever",
    ashby: "Ashby",
    workable: "Workable",
    smartrecruiters: "SmartRecruiters",
};

export { htmlToText } from "./html";

type Json = Record<string, unknown>;

const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const isObject = (value: unknown): value is Json => !!value && typeof value === "object" && !Array.isArray(value);

/** Arma la oferta solo si tiene lo mínimo para servir: id, título, link y descripción. */
function job(fields: Omit<IngestedJob, "externalId" | "title" | "url" | "description"> & {
    externalId: unknown;
    title: unknown;
    url: unknown;
    description: string | null;
}): IngestedJob | null {
    const externalId = fields.externalId === undefined || fields.externalId === null ? null : String(fields.externalId);
    const title = str(fields.title);
    const url = str(fields.url);
    if (!externalId || !title || !url || !/^https?:\/\//i.test(url) || !fields.description) return null;
    return { ...fields, externalId, title, url, description: fields.description };
}

const compact = (jobs: (IngestedJob | null)[]) => jobs.filter((item): item is IngestedJob => item !== null);

// Cuánto vale un período en meses de sueldo: 160 horas, 21 días o 52/12 semanas por mes
const PERIOD_FACTORS: [RegExp, number][] = [
    [/hour/, 160],
    [/day|daily/, 21],
    [/week/, 52 / 12],
    [/month/, 1],
    [/year|annual/, 1 / 12],
];

/**
 * Sueldo en USD por mes a partir del mínimo del rango (o el máximo si es lo único publicado).
 * Otras monedas o un período desconocido no se convierten: un tipo de cambio fijo quedaría viejo.
 */
export function monthlyUsd(min: unknown, max: unknown, currency: unknown, period: unknown): number | undefined {
    const amount = [min, max].map(Number).find((value) => Number.isFinite(value) && value > 0);
    if (amount === undefined || str(currency)?.toUpperCase() !== "USD") return undefined;
    const factor = PERIOD_FACTORS.find(([pattern]) => pattern.test(str(period)?.toLowerCase() ?? ""))?.[1];
    return factor === undefined ? undefined : Math.round(amount * factor);
}

/** El rango completo en USD por mes: `salaryUsdMonthly` es el mínimo y `salaryMaxUsdMonthly` el máximo publicado. */
export function monthlyUsdRange(
    min: unknown,
    max: unknown,
    currency: unknown,
    period: unknown
): Pick<IngestedJob, "salaryUsdMonthly" | "salaryMaxUsdMonthly"> {
    const floor = monthlyUsd(min, max, currency, period);
    const ceiling = monthlyUsd(max, min, currency, period);
    return {
        salaryUsdMonthly: floor,
        salaryMaxUsdMonthly: ceiling !== undefined && floor !== undefined && ceiling >= floor ? ceiling : undefined,
    };
}

/** Fecha de publicación en ISO a partir de lo que mande el portal: ISO, segundos o milisegundos unix. */
export function toIsoDate(value: unknown, now: Date = new Date()): string | undefined {
    let time: number;
    if (typeof value === "number") time = value < 1e12 ? value * 1000 : value;
    else if (typeof value === "string" && value.trim()) {
        const numeric = Number(value);
        time = Number.isFinite(numeric) && /^\d+$/.test(value.trim()) ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(value);
    } else return undefined;
    if (!Number.isFinite(time)) return undefined;
    const date = new Date(time);
    // Una fecha futura o de hace más de dos años no es la publicación de un aviso vigente
    if (date.getTime() > now.getTime() + 24 * 60 * 60 * 1000 || now.getTime() - date.getTime() > 2 * 365 * 24 * 60 * 60 * 1000) return undefined;
    return date.toISOString();
}

/** El nivel como lo publica Himalayas ("Entry-level", "Mid-level", "Senior", "Lead", "Manager"). */
const HIMALAYAS_SENIORITY: [RegExp, Seniority][] = [
    [/intern|entry/i, "JUNIOR"],
    [/junior/i, "JUNIOR"],
    [/mid/i, "SEMI_SENIOR"],
    [/senior/i, "SENIOR"],
    [/lead|manager|director|principal|staff|head|vp|executive/i, "LEAD"],
];

function himalayasSeniority(value: unknown): Seniority | null {
    const levels = Array.isArray(value) ? value.map(str).filter((level): level is string => !!level) : [];
    for (const level of levels) {
        const match = HIMALAYAS_SENIORITY.find(([pattern]) => pattern.test(level));
        if (match) return match[1];
    }
    return null;
}

export function parseRemotive(data: unknown): IngestedJob[] {
    const jobs = isObject(data) && Array.isArray(data.jobs) ? data.jobs : [];
    return compact(
        jobs.filter(isObject).map((item) =>
            job({
                source: "remotive",
                externalId: item.id,
                title: item.title,
                company: str(item.company_name),
                url: item.url,
                applyUrl: null,
                description: str(item.description) && htmlToText(item.description as string),
                location: str(item.candidate_required_location),
                publishedAt: toIsoDate(item.publication_date),
            })
        )
    );
}

export function parseRemoteOk(data: unknown): IngestedJob[] {
    // El primer elemento es el aviso legal de la API, no una oferta
    const jobs = Array.isArray(data) ? data.filter((item) => isObject(item) && item.position) : [];
    return compact(
        jobs.filter(isObject).map((item) =>
            job({
                source: "remoteok",
                externalId: item.id,
                title: item.position,
                company: str(item.company),
                url: item.url,
                applyUrl: str(item.apply_url),
                description: str(item.description) && htmlToText(item.description as string),
                location: str(item.location),
                // Remote OK publica el sueldo anual en USD
                ...monthlyUsdRange(item.salary_min, item.salary_max, "USD", "year"),
                publishedAt: toIsoDate(item.date),
            })
        )
    );
}

export function parseHimalayas(data: unknown): IngestedJob[] {
    const jobs = isObject(data) && Array.isArray(data.jobs) ? data.jobs : [];
    return compact(
        jobs.filter(isObject).map((item) =>
            job({
                source: "himalayas",
                externalId: item.guid ?? item.applicationLink,
                title: item.title,
                company: str(item.companyName),
                url: item.applicationLink,
                applyUrl: null,
                description: str(item.description) && htmlToText(item.description as string),
                location: Array.isArray(item.locationRestrictions) ? himalayasLocation(item.locationRestrictions) : null,
                ...monthlyUsdRange(item.minSalary, item.maxSalary, item.currency, item.salaryPeriod),
                // pubDate viene en segundos unix; seniority es una lista como ["Senior"]
                publishedAt: toIsoDate(item.pubDate),
                seniorityHint: himalayasSeniority(item.seniority),
            })
        )
    );
}

/**
 * Países donde se puede vivir para la oferta de Himalayas. Sin restricción es worldwide; una lista
 * larga que incluye Argentina se resume ("Argentina y 73 países más") para que se pueda leer.
 */
function himalayasLocation(restrictions: unknown[]): string {
    const countries = restrictions.map(str).filter((country): country is string => !!country);
    if (countries.length === 0) return "Worldwide";
    if (countries.length > 3 && countries.includes("Argentina")) return `Argentina y ${countries.length - 1} países más`;
    return countries.join(", ");
}

export function parseJobicy(data: unknown): IngestedJob[] {
    const jobs = isObject(data) && Array.isArray(data.jobs) ? data.jobs : [];
    return compact(
        jobs.filter(isObject).map((item) =>
            job({
                source: "jobicy",
                externalId: item.id,
                title: item.jobTitle,
                company: str(item.companyName),
                // Jobicy pide que la postulación vaya a su link original: no hay formulario aparte
                url: item.url,
                applyUrl: null,
                description: str(item.jobDescription) && htmlToText(item.jobDescription as string),
                location: str(item.jobGeo),
                ...monthlyUsdRange(item.salaryMin, item.salaryMax, item.salaryCurrency, item.salaryPeriod),
                publishedAt: toIsoDate(item.pubDate),
            })
        )
    );
}

/** Nombres de una relación expandida de Get on Board ({ data: [{ attributes: { name } }] }). */
function relationNames(relation: unknown): string[] {
    const items = isObject(relation) && Array.isArray(relation.data) ? relation.data : [];
    return items.flatMap((item) => {
        if (!isObject(item) || !isObject(item.attributes)) return [];
        const name = str(item.attributes.name);
        const country = str(item.attributes.country);
        return name ? [country ? `${name}, ${country}` : name] : [];
    });
}

/** El nivel de Get on Board ("No experience", "Junior", "Semi Senior", "Senior", "Expert"). Solo llega si se pide en `expand`. */
const GET_ON_BOARD_SENIORITY: [RegExp, Seniority][] = [
    [/no experience|sin experiencia/i, "TRAINEE"],
    [/semi/i, "SEMI_SENIOR"],
    [/junior/i, "JUNIOR"],
    [/senior|expert/i, "SENIOR"],
];

function getOnBoardSeniority(relation: unknown): Seniority | null {
    const level = isObject(relation) && isObject(relation.data) && isObject(relation.data.attributes) ? str(relation.data.attributes.name) : null;
    if (!level) return null;
    return GET_ON_BOARD_SENIORITY.find(([pattern]) => pattern.test(level))?.[1] ?? null;
}

/**
 * Ubicación legible a partir de la modalidad de Get on Board: "Remoto", "Remoto desde South America",
 * "Híbrido · Santiago, Chile" o "Presencial · Argentina". Así los filtros saben dónde hay que estar.
 */
function getOnBoardLocation(attributes: Json): string | null {
    const countries = Array.isArray(attributes.countries)
        ? attributes.countries.map(str).filter((country): country is string => !!country && country !== "Remote")
        : [];
    const cities = relationNames(attributes.location_cities);
    const where = (cities.length ? cities : countries).join(", ");

    switch (attributes.remote_modality) {
        case "fully_remote":
            return "Remoto";
        case "remote_local": {
            const allowed = [...relationNames(attributes.location_regions), ...relationNames(attributes.location_tenants)];
            return allowed.length ? `Remoto desde ${allowed.join(", ")}` : "Remoto";
        }
        case "hybrid":
            return where ? `Híbrido · ${where}` : "Híbrido";
        case "no_remote":
            return where ? `Presencial · ${where}` : "Presencial";
        default:
            return attributes.remote ? "Remoto" : where || null;
    }
}

export function parseGetOnBoard(data: unknown): IngestedJob[] {
    const jobs = isObject(data) && Array.isArray(data.data) ? data.data : [];
    return compact(
        jobs.filter(isObject).map((item) => {
            const attributes = isObject(item.attributes) ? item.attributes : {};
            const companyData = isObject(attributes.company) && isObject(attributes.company.data) ? attributes.company.data : {};
            const company = isObject(companyData.attributes) ? str(companyData.attributes.name) : null;
            const links = isObject(item.links) ? item.links : {};
            const parts = [attributes.description, attributes.functions, attributes.desirable].map(str).filter(Boolean);
            return job({
                source: "getonbrd",
                externalId: item.id,
                title: attributes.title,
                company,
                url: links.public_url,
                applyUrl: null,
                description: parts.length ? htmlToText(parts.join("\n")) : null,
                location: getOnBoardLocation(attributes),
                // Get on Board publica el rango en USD por mes y la fecha en segundos unix
                ...monthlyUsdRange(attributes.min_salary, attributes.max_salary, "USD", "month"),
                publishedAt: toIsoDate(attributes.published_at),
                seniorityHint: getOnBoardSeniority(attributes.seniority),
            });
        })
    );
}

export function parseGreenhouse(data: unknown, board: string): IngestedJob[] {
    const jobs = isObject(data) && Array.isArray(data.jobs) ? data.jobs : [];
    return compact(
        jobs.filter(isObject).map((item) =>
            job({
                source: "greenhouse",
                externalId: `${board}:${item.id}`,
                title: item.title,
                company: str(item.company_name) ?? board,
                url: item.absolute_url,
                applyUrl: null,
                description: str(item.content) && htmlToText(item.content as string),
                location: isObject(item.location) ? str(item.location.name) : null,
                publishedAt: toIsoDate(item.first_published ?? item.updated_at),
            })
        )
    );
}

export function parseLever(data: unknown, board: string): IngestedJob[] {
    const jobs = Array.isArray(data) ? data : [];
    return compact(
        jobs.filter(isObject).map((item) => {
            const lists = Array.isArray(item.lists)
                ? item.lists.filter(isObject).map((list) => `${str(list.text) ?? ""}\n${htmlToText(str(list.content) ?? "")}`)
                : [];
            const description = [str(item.descriptionPlain), ...lists].filter(Boolean).join("\n\n");
            return job({
                source: "lever",
                externalId: `${board}:${item.id}`,
                title: item.text,
                company: board,
                url: item.hostedUrl,
                applyUrl: str(item.applyUrl),
                description: description || null,
                location: isObject(item.categories) ? str(item.categories.location) : null,
                ...(isObject(item.salaryRange)
                    ? monthlyUsdRange(item.salaryRange.min, item.salaryRange.max, item.salaryRange.currency, item.salaryRange.interval)
                    : {}),
                // Lever manda createdAt en milisegundos
                publishedAt: toIsoDate(item.createdAt),
            });
        })
    );
}

export function parseAshby(data: unknown, board: string): IngestedJob[] {
    const jobs = isObject(data) && Array.isArray(data.jobs) ? data.jobs : [];
    return compact(
        jobs.filter(isObject).map((item) =>
            job({
                source: "ashby",
                externalId: `${board}:${item.id}`,
                title: item.title,
                company: board,
                url: item.jobUrl,
                applyUrl: str(item.applyUrl),
                description: str(item.descriptionPlain) ?? (str(item.descriptionHtml) && htmlToText(item.descriptionHtml as string)),
                location: str(item.location),
                publishedAt: toIsoDate(item.publishedAt),
            })
        )
    );
}

/** Workable: "Remoto desde Colombia, Argentina" si es remota; si no, la ciudad y el país. */
function workableLocation(item: Json): string | null {
    const countries = Array.isArray(item.locations)
        ? Array.from(new Set(item.locations.filter(isObject).map((location) => str(location.country)).filter((country) => !!country)))
        : [];
    const where = countries.length ? countries.join(", ") : [str(item.city), str(item.country)].filter(Boolean).join(", ");
    if (item.telecommuting) return where ? `Remoto desde ${where}` : "Remoto";
    return where || null;
}

export function parseWorkable(data: unknown, board: string): IngestedJob[] {
    const jobs = isObject(data) && Array.isArray(data.jobs) ? data.jobs : [];
    const company = isObject(data) ? str(data.name) : null;
    return compact(
        jobs.filter(isObject).map((item) =>
            job({
                source: "workable",
                externalId: item.shortcode === undefined ? undefined : `${board}:${item.shortcode}`,
                title: item.title,
                company: company ?? board,
                url: item.url,
                applyUrl: str(item.application_url),
                description: str(item.description) && htmlToText(item.description as string),
                location: workableLocation(item),
                publishedAt: toIsoDate(item.published ?? item.created_at),
            })
        )
    );
}

/** SmartRecruiters: la modalidad viene en banderas (remote, hybrid) junto a la ubicación completa. */
function smartRecruitersLocation(location: Json): string | null {
    const where = str(location.fullLocation) ?? ([str(location.city), str(location.country)?.toUpperCase()].filter(Boolean).join(", ") || null);
    if (location.remote) return where ? `Remoto desde ${where}` : "Remoto";
    if (location.hybrid) return where ? `Híbrido · ${where}` : "Híbrido";
    return where ? `Presencial · ${where}` : null;
}

/** Una publicación de SmartRecruiters con su detalle (la lista no trae la descripción). */
export function parseSmartRecruitersPosting(data: unknown, board: string): IngestedJob | null {
    if (!isObject(data)) return null;
    const sections = isObject(data.jobAd) && isObject(data.jobAd.sections) ? data.jobAd.sections : {};
    // La descripción de la empresa queda afuera: no son requisitos y ensucia el match
    const parts = ["jobDescription", "qualifications", "additionalInformation"]
        .map((key) => (isObject(sections[key]) ? str(sections[key].text) : null))
        .filter(Boolean);
    return job({
        source: "smartrecruiters",
        externalId: data.id === undefined ? undefined : `${board}:${data.id}`,
        title: data.name,
        company: isObject(data.company) ? str(data.company.name) ?? board : board,
        url: data.postingUrl,
        applyUrl: str(data.applyUrl),
        description: parts.length ? htmlToText(parts.join("\n")) : null,
        location: isObject(data.location) ? smartRecruitersLocation(data.location) : null,
        publishedAt: toIsoDate(data.releasedDate),
    });
}

/** "greenhouse:stripe" → { source: "greenhouse", board: "stripe" }; null si no es válido. */
export function parseAtsBoard(value: string): { source: AtsSource; board: string } | null {
    const match = value
        .trim()
        .toLowerCase()
        .match(/^(greenhouse|lever|ashby|workable|smartrecruiters):([a-z0-9][a-z0-9._-]{0,99})$/);
    return match ? { source: match[1] as AtsSource, board: match[2] } : null;
}

const USER_AGENT = "KeyWords job tracker (+https://kwtools.vercel.app)";
// Las páginas públicas de Computrabajo responden a un navegador, no a un cliente genérico
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
/** Detalles que se piden por empresa en SmartRecruiters (un pedido por publicación). */
const SMARTRECRUITERS_MAX_DETAILS = 40;
const TIMEOUT_MS = 15_000;

async function getJson(url: string): Promise<unknown> {
    const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} (${url})`);
    return response.json();
}

/** Una página HTML pública, pedida como la pediría un navegador en Argentina. */
export async function getText(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Language": "es-AR,es;q=0.9" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} (${url})`);
    return response.text();
}

/** Ofertas recientes de un portal agregador. `terms` son los puestos buscados. */
export async function fetchAggregator(source: AggregatorSource, terms: string[]): Promise<IngestedJob[]> {
    switch (source) {
        case "remotive":
            // Pide no consultar más de unas pocas veces por día: un pedido por búsqueda
            return parseRemotive(await getJson("https://remotive.com/api/remote-jobs?limit=200"));
        case "remoteok":
            return parseRemoteOk(await getJson("https://remoteok.com/api"));
        case "himalayas": {
            // La búsqueda con country=AR trae solo ofertas que aceptan candidatos desde Argentina (20 por página)
            const pages = await Promise.all(
                terms.slice(0, 6).flatMap((term) =>
                    [1, 2].map((page) =>
                        getJson(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(term)}&country=AR&page=${page}`)
                    )
                )
            );
            return pages.flatMap(parseHimalayas);
        }
        case "getonbrd": {
            const results = await Promise.all(
                terms.map((term) =>
                    getJson(
                        `https://www.getonbrd.com/api/v0/search/jobs?query=${encodeURIComponent(term)}&per_page=50` +
                            `&expand=["company","location_cities","location_regions","location_tenants","seniority"]`
                    )
                )
            );
            return results.flatMap(parseGetOnBoard);
        }
        case "jobicy": {
            const results = await Promise.all(
                ["latam", "argentina"].map((geo) =>
                    getJson(`https://jobicy.com/api/v2/remote-jobs?count=50&geo=${geo}&industry=engineering`)
                )
            );
            return results.flatMap(parseJobicy);
        }
        case "computrabajo":
            // Sin API: se leen las páginas de resultados por puesto y el detalle de las recientes
            return fetchComputrabajo(terms, getText);
    }
}

/** Ofertas abiertas de una empresa en su ATS. */
export async function fetchAtsBoard(source: AtsSource, board: string): Promise<IngestedJob[]> {
    const name = encodeURIComponent(board);
    switch (source) {
        case "greenhouse":
            return parseGreenhouse(await getJson(`https://boards-api.greenhouse.io/v1/boards/${name}/jobs?content=true`), board);
        case "lever":
            return parseLever(await getJson(`https://api.lever.co/v0/postings/${name}?mode=json`), board);
        case "ashby":
            return parseAshby(await getJson(`https://api.ashbyhq.com/posting-api/job-board/${name}`), board);
        case "workable":
            return parseWorkable(await getJson(`https://apply.workable.com/api/v1/widget/accounts/${name}?details=true`), board);
        case "smartrecruiters": {
            // La lista no trae la descripción: se piden los detalles de las publicadas en Argentina
            const list = await getJson(`https://api.smartrecruiters.com/v1/companies/${name}/postings?country=ar&limit=100`);
            const ids = (isObject(list) && Array.isArray(list.content) ? list.content : [])
                .filter(isObject)
                .map((posting) => str(posting.id))
                .filter((id): id is string => !!id)
                .slice(0, SMARTRECRUITERS_MAX_DETAILS);
            const details = await Promise.all(
                ids.map((id) =>
                    getJson(`https://api.smartrecruiters.com/v1/companies/${name}/postings/${encodeURIComponent(id)}`).catch(() => null)
                )
            );
            return details.flatMap((detail) => parseSmartRecruitersPosting(detail, board) ?? []);
        }
    }
}
