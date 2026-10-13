import fuzzysort from "fuzzysort";
import { aliasKey, matchText, type AliasIndex } from "./core";

export interface MergeTarget {
    id: string;
    name: string;
}

export interface MergeSuggestions {
    /** Entrada que ya tiene este término como alias: para el diccionario son lo mismo. */
    sameAs: MergeTarget | null;
    /** Otras entradas a las que podría corresponder, de la más probable a la menos. */
    similar: MergeTarget[];
}

// Con menos letras la búsqueda aproximada devuelve cualquier nombre que las contenga
// ("ai" aparece dentro de OpenAI, Airflow y Tailwind), así que no se usa.
const MIN_FUZZY_LENGTH = 4;

/**
 * A qué entradas del diccionario podría corresponder un término sin verificar.
 * Solo propone: la decisión de fusionar la toma siempre un admin.
 */
export function suggestMergeTargets(
    term: string,
    dictionary: { index: AliasIndex; keywords: ReadonlyMap<string, MergeTarget> },
    max = 3
): MergeSuggestions {
    // El término suelto se busca por su clave, sin exigir la capitalización exacta que
    // rige en texto libre: "ai" como keyword aislada es el alias "AI"
    const owner = dictionary.index.get(aliasKey(term));
    const sameAs = owner ? dictionary.keywords.get(owner.keywordId) ?? null : null;

    const candidates: MergeTarget[] = [];

    // Entradas mencionadas dentro del término: "experiencia en React" → React
    for (const keywordId of matchText(term, dictionary.index).keys()) {
        const keyword = dictionary.keywords.get(keywordId);
        if (keyword) candidates.push(keyword);
    }

    // Nombres que empiezan igual o lo contienen: "postgre" → PostgreSQL
    if (term.trim().length >= MIN_FUZZY_LENGTH) {
        const targets = Array.from(dictionary.keywords.values());
        for (const result of fuzzysort.go(term, targets, { key: "name", limit: max })) {
            candidates.push(result.obj);
        }
    }

    const similar = new Map<string, MergeTarget>();
    for (const candidate of candidates) {
        if (candidate.id !== sameAs?.id && similar.size < max) {
            similar.set(candidate.id, { id: candidate.id, name: candidate.name });
        }
    }

    return {
        sameAs: sameAs && { id: sameAs.id, name: sameAs.name },
        similar: Array.from(similar.values()),
    };
}
