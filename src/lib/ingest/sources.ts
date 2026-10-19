/**
 * Fuentes de ofertas con API pública. Cada una convierte su respuesta a `IngestedJob`.
 * Los parsers son puros (se testean con respuestas reales); `fetchSource` hace los pedidos.
 * Solo se usan APIs abiertas que los portales ofrecen para esto: nada de scraping.
 */

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
}

/** Portales que agregan ofertas de muchas empresas: se consultan una vez por búsqueda. */
export const AGGREGATOR_SOURCES = ["remotive", "remoteok", "himalayas", "getonbrd", "jobicy"] as const;
/** Portales que se consultan por cada puesto deseado, no una sola vez para todos. */
export const SEARCH_BY_TERM_SOURCES = new Set<string>(["himalayas", "getonbrd"]);
/** ATS de empresas: se consultan por cada empresa que siga el usuario ("greenhouse:stripe"). */
export const ATS_SOURCES = ["greenhouse", "lever", "ashby"] as const;

export type AggregatorSource = typeof AGGREGATOR_SOURCES[number];
export type AtsSource = typeof ATS_SOURCES[number];

export const SOURCE_LABELS: Record<AggregatorSource | AtsSource, string> = {
    remotive: "Remotive (remoto)",
    remoteok: "Remote OK (remoto)",
    himalayas: "Himalayas (remoto)",
    getonbrd: "Get on Board (LatAm)",
    jobicy: "Jobicy (remoto, LatAm)",
    greenhouse: "Greenhouse",
    lever: "Lever",
    ashby: "Ashby",
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
        if (code[0] === "#") {
            const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return Number.isFinite(value) ? String.fromCodePoint(value) : match;
        }
        return ENTITIES[code.toLowerCase()] ?? match;
    });
}

/** HTML a texto plano conservando los saltos de párrafo y las viñetas. */
export function htmlToText(html: string): string {
    // Greenhouse manda el HTML con las entidades escapadas (&lt;p&gt;): primero se decodifica
    const source = /&lt;\/?[a-z]/i.test(html) ? decodeEntities(html) : html;
    return decodeEntities(
        source
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
            .replace(/<li[^>]*>/gi, "\n• ")
            .replace(/<\/(p|div|h[1-6]|ul|ol)>|<br\s*\/?>/gi, "\n")
            .replace(/<[^>]+>/g, "")
    )
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*/g, "\n\n")
        .trim();
}

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
            })
        )
    );
}

/** "greenhouse:stripe" → { source: "greenhouse", board: "stripe" }; null si no es válido. */
export function parseAtsBoard(value: string): { source: AtsSource; board: string } | null {
    const match = value.trim().toLowerCase().match(/^(greenhouse|lever|ashby):([a-z0-9][a-z0-9._-]{0,99})$/);
    return match ? { source: match[1] as AtsSource, board: match[2] } : null;
}

const USER_AGENT = "KeyWords job tracker (+https://kwtools.vercel.app)";
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
                            `&expand=["company","location_cities","location_regions","location_tenants"]`
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
    }
}
