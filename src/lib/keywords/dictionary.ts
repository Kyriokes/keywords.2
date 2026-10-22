import "server-only";

import prisma from "@/lib/prisma";
import { aliasKey, matchText, type AliasIndex } from "./core";
import { toKeywordCategory, type KeywordCategory } from "./categories";

export interface DictionaryKeyword {
    id: string;
    name: string;
    category: KeywordCategory;
}

interface Dictionary {
    index: AliasIndex;
    keywords: Map<string, DictionaryKeyword>;
}

// El diccionario verificado es chico (miles de alias): se guarda en memoria por instancia.
// Los cambios hechos desde /admin se ven en esta instancia al momento y en las demás al vencer.
const CACHE_TTL_MS = 60_000;
let cached: { dictionary: Dictionary; loadedAt: number } | null = null;
// La lectura en curso: los pedidos que llegan mientras tanto la esperan en vez de leer todo otra vez
let loading: Promise<Dictionary> | null = null;
// Cambia con cada invalidación: una lectura que empezó antes no pisa lo que se invalidó en el medio
let generation = 0;

export function invalidateDictionary() {
    cached = null;
    loading = null;
    generation++;
}

export function keywordName(keyword: { displayName: string | null; canonicalText: string }): string {
    return keyword.displayName || keyword.canonicalText;
}

/** Diccionario verificado: solo keywords aprobadas y no bloqueadas. */
export async function getDictionary(): Promise<Dictionary> {
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached.dictionary;
    }
    if (!loading) {
        const started = generation;
        loading = loadDictionary()
            .then((dictionary) => {
                if (started === generation) cached = { dictionary, loadedAt: Date.now() };
                return dictionary;
            })
            .finally(() => {
                if (started === generation) loading = null;
            });
    }
    return loading;
}

async function loadDictionary(): Promise<Dictionary> {
    const aliases = await prisma.keywordAlias.findMany({
        where: { keyword: { isApproved: true, isBlocked: false } },
        select: {
            aliasText: true,
            exactText: true,
            keyword: { select: { id: true, displayName: true, canonicalText: true, category: true } },
        },
    });

    const dictionary: Dictionary = { index: new Map(), keywords: new Map() };
    for (const alias of aliases) {
        dictionary.index.set(alias.aliasText, { keywordId: alias.keyword.id, exactText: alias.exactText });
        dictionary.keywords.set(alias.keyword.id, {
            id: alias.keyword.id,
            name: keywordName(alias.keyword),
            category: toKeywordCategory(alias.keyword.category),
        });
    }
    return dictionary;
}

/** Keywords del diccionario mencionadas en un texto libre (CV u oferta), con cantidad de menciones. */
export async function detectKeywords(text: string): Promise<Array<DictionaryKeyword & { count: number }>> {
    const { index, keywords } = await getDictionary();

    const detected: Array<DictionaryKeyword & { count: number }> = [];
    for (const [keywordId, count] of matchText(text, index)) {
        const keyword = keywords.get(keywordId);
        if (keyword) {
            detected.push({ ...keyword, count });
        }
    }
    return detected;
}

export interface ResolvedTerm {
    id: string;
    name: string;
    verified: boolean;
    blocked: boolean;
}

/**
 * Busca términos sueltos (por ejemplo, los que devuelve el LLM) entre las keywords existentes,
 * verificadas o no. Devuelve un mapa por clave de alias; los que no existen no aparecen.
 */
export async function lookupTerms(terms: string[]): Promise<Map<string, ResolvedTerm>> {
    const keys = Array.from(new Set(terms.map(aliasKey).filter(Boolean)));
    if (keys.length === 0) {
        return new Map();
    }

    const aliases = await prisma.keywordAlias.findMany({
        where: { aliasText: { in: keys } },
        select: {
            aliasText: true,
            keyword: {
                select: { id: true, displayName: true, canonicalText: true, isApproved: true, isBlocked: true },
            },
        },
    });

    return new Map(
        aliases.map((alias) => [
            alias.aliasText,
            {
                id: alias.keyword.id,
                name: keywordName(alias.keyword),
                verified: alias.keyword.isApproved,
                blocked: alias.keyword.isBlocked,
            },
        ])
    );
}

/**
 * Convierte términos sueltos en ids de keyword. Los que el diccionario no conoce se guardan
 * como keywords sin verificar (con su alias, para que la próxima variante caiga en la misma).
 * Las bloqueadas se descartan.
 */
export async function resolveTerms(terms: string[]): Promise<string[]> {
    const termByKey = new Map<string, string>();
    for (const term of terms) {
        const key = aliasKey(term);
        if (key && !termByKey.has(key)) {
            termByKey.set(key, term.trim());
        }
    }
    if (termByKey.size === 0) {
        return [];
    }

    let known = await lookupTerms(Array.from(termByKey.values()));
    const unknown = Array.from(termByKey).filter(([key]) => !known.has(key));

    if (unknown.length > 0) {
        // canonicalText conserva el formato histórico (minúsculas): así una keyword vieja con el
        // mismo texto se reutiliza en lugar de chocar contra su restricción de unicidad.
        const canonicalByKey = new Map(unknown.map(([key, term]) => [key, term.toLowerCase()]));

        await prisma.keyword.createMany({
            data: unknown.map(([key, term]) => ({
                canonicalText: canonicalByKey.get(key)!,
                displayName: term,
                source: "user",
            })),
            skipDuplicates: true,
        });

        const keywords = await prisma.keyword.findMany({
            where: { canonicalText: { in: Array.from(canonicalByKey.values()) } },
            select: { id: true, canonicalText: true },
        });
        const idByCanonical = new Map(keywords.map((keyword) => [keyword.canonicalText, keyword.id]));

        await prisma.keywordAlias.createMany({
            data: unknown.flatMap(([key]) => {
                const keywordId = idByCanonical.get(canonicalByKey.get(key)!);
                return keywordId ? [{ aliasText: key, keywordId }] : [];
            }),
            skipDuplicates: true,
        });

        // Se vuelve a leer: si otro request creó el mismo alias en el medio, gana el que quedó guardado
        known = await lookupTerms(Array.from(termByKey.values()));
    }

    const ids = new Set<string>();
    for (const key of termByKey.keys()) {
        const keyword = known.get(key);
        if (keyword && !keyword.blocked) {
            ids.add(keyword.id);
        }
    }
    return Array.from(ids);
}

export interface OfferKeyword {
    nombre: string;
    cantidad: number;
    /** false si el término todavía no está en el diccionario. */
    verificada: boolean;
}

/**
 * Estandariza las keywords de una oferta: pasa las del LLM por el diccionario (uniendo variantes
 * del mismo término) y suma las que el diccionario encuentra en el texto y el LLM omitió.
 * No guarda nada: solo arma lo que el usuario va a revisar.
 */
export async function standardizeOfferKeywords(
    aiKeywords: Array<{ nombre: string; cantidad: number }>,
    offerText: string,
    max: number
): Promise<OfferKeyword[]> {
    const known = await lookupTerms(aiKeywords.map((keyword) => keyword.nombre));
    const byIdentity = new Map<string, OfferKeyword>();

    for (const keyword of aiKeywords) {
        const key = aliasKey(keyword.nombre);
        if (!key) continue;

        const match = known.get(key);
        if (match?.blocked) continue;

        const identity = match ? `id:${match.id}` : `key:${key}`;
        const existing = byIdentity.get(identity);
        if (existing) {
            existing.cantidad += keyword.cantidad;
        } else {
            byIdentity.set(identity, {
                nombre: match ? match.name : keyword.nombre,
                cantidad: keyword.cantidad,
                verificada: match?.verified ?? false,
            });
        }
    }

    const detected = await detectKeywords(offerText);
    for (const keyword of detected.sort((a, b) => b.count - a.count)) {
        const identity = `id:${keyword.id}`;
        if (!byIdentity.has(identity)) {
            byIdentity.set(identity, { nombre: keyword.name, cantidad: keyword.count, verificada: true });
        }
    }

    return Array.from(byIdentity.values()).slice(0, max);
}
