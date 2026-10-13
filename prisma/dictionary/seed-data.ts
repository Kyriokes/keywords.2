import techSeed from "./tech.json";
import { MAX_ALIAS_WORDS, aliasKey, tokenizeText } from "../../src/lib/keywords/core";
import { isKeywordCategory, type KeywordCategory } from "../../src/lib/keywords/categories";

type RawAlias = string | { text: string; exact?: boolean };

interface RawSeedEntry {
    name: string;
    category: string;
    aliases: RawAlias[];
    /** El nombre también es una palabra común: en texto libre exige esta escritura exacta. */
    exact?: boolean;
    source?: string;
}

export interface SeedAlias {
    aliasText: string;
    exactText: string | null;
}

export interface SeedEntry {
    name: string;
    canonicalText: string;
    category: KeywordCategory;
    source: string;
    aliases: SeedAlias[];
}

/** Convierte la semilla en filas listas para guardar: una clave de alias por variante. */
export function loadSeed(): SeedEntry[] {
    return (techSeed as RawSeedEntry[]).map((entry) => {
        const aliases = new Map<string, SeedAlias>();
        const add = (text: string, exact: boolean) => {
            const aliasText = aliasKey(text);
            if (!aliases.has(aliasText)) {
                aliases.set(aliasText, { aliasText, exactText: exact ? text : null });
            }
        };

        add(entry.name, entry.exact === true);
        for (const alias of entry.aliases) {
            if (typeof alias === "string") {
                add(alias, false);
            } else {
                add(alias.text, alias.exact === true);
            }
        }

        return {
            name: entry.name,
            canonicalText: entry.name.toLowerCase(),
            category: entry.category as KeywordCategory,
            source: entry.source ?? "seed",
            aliases: Array.from(aliases.values()),
        };
    });
}

/** Errores que harían ambigua o inútil la semilla. Vacío si está bien. */
export function findSeedProblems(entries: SeedEntry[]): string[] {
    const problems: string[] = [];
    const ownerByAlias = new Map<string, string>();
    const names = new Set<string>();

    for (const entry of entries) {
        if (!isKeywordCategory(entry.category)) {
            problems.push(`"${entry.name}": categoría desconocida "${entry.category}"`);
        }
        if (names.has(entry.canonicalText)) {
            problems.push(`"${entry.name}": nombre repetido`);
        }
        names.add(entry.canonicalText);

        if (tokenizeText(entry.name).length > MAX_ALIAS_WORDS) {
            problems.push(`"${entry.name}": el nombre supera ${MAX_ALIAS_WORDS} palabras y no se detectaría en texto`);
        }

        for (const alias of entry.aliases) {
            if (!alias.aliasText) {
                problems.push(`"${entry.name}": tiene un alias sin clave`);
                continue;
            }
            if (alias.exactText && tokenizeText(alias.exactText).length !== 1) {
                problems.push(`"${entry.name}": "${alias.exactText}" es exacto pero no es una sola palabra`);
            }
            const owner = ownerByAlias.get(alias.aliasText);
            if (owner && owner !== entry.name) {
                problems.push(`alias "${alias.aliasText}" compartido por "${owner}" y "${entry.name}"`);
            }
            ownerByAlias.set(alias.aliasText, entry.name);
        }
    }

    return problems;
}
