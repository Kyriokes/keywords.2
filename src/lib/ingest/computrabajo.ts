/**
 * Computrabajo (Argentina) no tiene API: se leen sus páginas públicas de resultados, pocas por búsqueda,
 * y el detalle de las ofertas recientes. Las ofertas se postulan con la cuenta del usuario (UNSUPPORTED).
 * Los parsers son puros y se testean con páginas reales guardadas en ./fixtures.
 */

import { htmlToText } from "./html";
import type { IngestedJob } from "./sources";

const BASE_URL = "https://ar.computrabajo.com";
/** Páginas de resultados que se leen por puesto (20 avisos cada una). */
const PAGES = [1, 2];
/** Avisos más viejos que esto ya los vio el usuario o ya están cubiertos. */
const MAX_AGE_DAYS = 7;
/** Detalles que se piden por búsqueda, de más nuevo a más viejo. */
const MAX_DETAILS = 30;
/** Detalles que se piden a la vez: Computrabajo es un sitio de personas, no una API. */
const CONCURRENCY = 3;
const MAX_SLUGS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Cómo se busca cada puesto en Computrabajo ("trabajo-de-<slug>"); un rol desconocido usa su nombre. */
export const COMPUTRABAJO_SLUGS: Record<string, string[]> = {
    "Full Stack Developer": ["desarrollador-full-stack"],
    "Frontend Developer": ["desarrollador-frontend"],
    "Backend Developer": ["desarrollador-backend"],
    "Software Developer": ["desarrollador-de-software", "programador"],
    "Web Developer": ["desarrollador-web"],
    "Mobile Developer": ["desarrollador-mobile"],
    "AI/ML Engineer": ["desarrollador-ia"],
};

const slugify = (text: string) =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

export function computrabajoSlugs(terms: string[]): string[] {
    return Array.from(new Set(terms.flatMap((term) => COMPUTRABAJO_SLUGS[term] ?? [slugify(term)]).filter(Boolean)));
}

export function computrabajoSearchUrl(slug: string, page = 1): string {
    return `${BASE_URL}/trabajo-de-${slug}${page > 1 ? `?p=${page}` : ""}`;
}

/** Una tarjeta de la lista de resultados. */
export interface ComputrabajoCard {
    id: string;
    url: string;
    title: string;
    company: string | null;
    location: string | null;
    /** Etiquetas de la tarjeta: modalidad, sueldo, tipo de contrato. */
    tags: string;
    /** Días desde la publicación; null si la fecha no se entendió. */
    ageDays: number | null;
}

const text = (html: string | undefined) => (html ? htmlToText(html).replace(/\s+/g, " ").trim() : "");
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "Hace 17 horas" → 0, "Ayer" → 1, "Hace 3 días" → 3, "Más de 30 días" → 31, "2 de octubre" → los días hasta hoy. */
export function computrabajoAgeDays(raw: string, now: Date = new Date()): number | null {
    const value = normalize(text(raw));
    if (!value) return null;
    if (/^hoy\b/.test(value) || /hace \d+ (hora|minuto)/.test(value)) return 0;
    if (/^ayer\b/.test(value)) return 1;
    const days = value.match(/hace (\d+) dia/);
    if (days) return Number(days[1]);
    if (/mas de 30 dias/.test(value)) return 31;
    const dated = value.match(/^(\d{1,2}) de ([a-z]+)/);
    if (dated) {
        const month = MONTHS.indexOf(dated[2]);
        if (month < 0) return null;
        const date = new Date(now.getFullYear(), month, Number(dated[1]));
        if (date.getTime() > now.getTime()) date.setFullYear(date.getFullYear() - 1);
        return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
    }
    return null;
}

const CARD = /<article[^>]*class="[^"]*box_offer[^"]*"([^>]*)>([\s\S]*?)<\/article>/g;

export function parseComputrabajoList(html: string, now: Date = new Date()): ComputrabajoCard[] {
    const cards = new Map<string, ComputrabajoCard>();
    for (const match of html.matchAll(CARD)) {
        const [, attributes, body] = match;
        const id = attributes.match(/data-id=['"]([0-9A-Za-z]+)['"]/)?.[1];
        const link = body.match(/<a class="js-o-link fc_base" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!id || !link || cards.has(id)) continue;
        const company =
            text(body.match(/<a class="fc_base t_ellipsis"[^>]*>([\s\S]*?)<\/a>/)?.[1]) ||
            text(body.match(/<p class="dIB fs16 fc_base mt5">([\s\S]*?)<\/p>/)?.[1]);
        cards.set(id, {
            id,
            url: `${BASE_URL}${link[1].split("#")[0]}`,
            title: text(link[2]),
            company: company || null,
            location: text(body.match(/<p class="fs16 fc_base mt5">([\s\S]*?)<\/p>/)?.[1]) || null,
            tags: text(body.match(/<div class="fs13 mt15">([\s\S]*?)<\/div>/)?.[1]),
            ageDays: computrabajoAgeDays(body.match(/<p class="fs13 fc_aux mt15">([\s\S]*?)<\/p>/)?.[1] ?? "", now),
        });
    }
    return Array.from(cards.values());
}

/** La ubicación como la entienden los filtros: "Remoto", "Híbrido · Palermo, Capital Federal", "Presencial · …" o la ciudad. */
export function computrabajoLocation(card: Pick<ComputrabajoCard, "tags" | "location">): string | null {
    const tags = normalize(card.tags);
    if (/presencial y remoto/.test(tags)) return card.location ? `Híbrido · ${card.location}` : "Híbrido";
    if (/\bremoto\b/.test(tags)) return "Remoto";
    if (/presencial/.test(tags)) return card.location ? `Presencial · ${card.location}` : "Presencial";
    return card.location;
}

/** La descripción completa de la página de una oferta (encabezado, cuerpo y requerimientos); null si no se encontró. */
export function parseComputrabajoDetail(html: string): string | null {
    const marker = html.indexOf('div-link="oferta"');
    if (marker < 0) return null;
    const from = html.lastIndexOf("<div", marker);
    let to = html.indexOf('class="posSticky_m', from);
    if (to < 0) to = html.indexOf("Postularme", from);
    if (to < 0) to = from + 30_000;
    const description = htmlToText(html.slice(from, to)).replace(/\n{3,}/g, "\n\n").trim();
    return description || null;
}

export type GetText = (url: string) => Promise<string>;

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (next < items.length) {
                const index = next++;
                results[index] = await task(items[index]);
            }
        })
    );
    return results;
}

/** Ofertas recientes de Computrabajo para los puestos buscados, con su descripción completa. */
export async function fetchComputrabajo(terms: string[], getText: GetText, now: Date = new Date()): Promise<IngestedJob[]> {
    const urls = computrabajoSlugs(terms)
        .slice(0, MAX_SLUGS)
        .flatMap((slug) => PAGES.map((page) => computrabajoSearchUrl(slug, page)));
    const errors: unknown[] = [];
    const pages = await Promise.all(
        urls.map((url) =>
            getText(url).catch((error: unknown) => {
                errors.push(error);
                return "";
            })
        )
    );
    // Si ninguna página respondió, la fuente falló (Cloudflare, caída): que se vea en las estadísticas
    if (pages.every((page) => !page) && errors.length) throw errors[0];

    const seen = new Set<string>();
    const cards = pages
        .flatMap((page) => parseComputrabajoList(page, now))
        .filter((card) => !seen.has(card.id) && seen.add(card.id))
        .filter((card) => card.ageDays !== null && card.ageDays <= MAX_AGE_DAYS)
        .sort((a, b) => (a.ageDays ?? 0) - (b.ageDays ?? 0))
        .slice(0, MAX_DETAILS);

    const details = await mapLimit(cards, CONCURRENCY, (card) => getText(card.url).then(parseComputrabajoDetail).catch(() => null));

    return cards.flatMap((card, index) => {
        const description = details[index];
        if (!description) return [];
        return [
            {
                source: "computrabajo",
                externalId: card.id,
                title: card.title,
                company: card.company,
                url: card.url,
                // Postular pide la cuenta del usuario: no hay formulario aparte
                applyUrl: null,
                description,
                location: computrabajoLocation(card),
                publishedAt: new Date(now.getTime() - (card.ageDays ?? 0) * DAY_MS).toISOString(),
            },
        ];
    });
}
