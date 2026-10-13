// Núcleo del diccionario de keywords: funciones puras, sin imports, para poder usarlas
// igual desde el servidor, los tests y los scripts de `prisma/dictionary`.

/** Cantidad máxima de palabras que puede tener un alias para detectarse en texto libre. */
export const MAX_ALIAS_WORDS = 5;

export function normalizeTechnicalText(input: string): string {
    let text = input.normalize('NFKC');
    text = text.normalize('NFD').replace(/\p{M}+/gu, '');
    text = text.toLowerCase();
    text = text.replace(/[^\p{L}\p{N}\s+.#-]/gu, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

export function tokenize(text: string): string[] {
    const tokens: string[] = [];
    for (const match of text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}+.#-]*/gu)) {
        const token = match[0] || '';
        if (!token) {
            continue;
        }
        tokens.push(token);
    }
    return tokens;
}

export function cleanToken(token: string): string {
    return token
        .replace(/^[\s"'`([{<]+/, '')
        .replace(/[\s"'`)\]}>.,;:!?-]+$/, '')
        .replace(/\.{2,}$/, '');
}

export interface TextToken {
    /** Token tal como está escrito (sin puntuación de cierre). */
    raw: string;
    /** Parte de la clave de comparación: minúsculas, sin acentos, sin puntos ni guiones internos. */
    key: string;
    /** true si entre el token anterior y este hay puntuación que corta una frase. */
    breakBefore: boolean;
}

// Puntuación que separa ítems o frases: un alias de varias palabras nunca la atraviesa.
// La barra y el salto de línea no cortan ("CI/CD", o una frase partida por el ancho del PDF).
const PHRASE_BREAK = /[,;:|•·()[\]{}!?¿¡"“”]/u;

function stripDiacritics(value: string): string {
    return value.normalize('NFD').replace(/\p{M}+/gu, '');
}

/**
 * Parte un texto en tokens conservando la escritura original de cada uno.
 * ".NET" se trata aparte: el tokenizador descarta el punto inicial y quedaría como la palabra "net".
 */
export function tokenizeText(text: string): TextToken[] {
    const source = text
        .normalize('NFKC')
        .replace(/(^|[^\p{L}\p{N}.])\.net(?![\p{L}\p{N}])/giu, '$1dotnet');

    const tokens: TextToken[] = [];
    let previousEnd = 0;
    let previousEndedSentence = false;

    for (const match of source.matchAll(/[\p{L}\p{N}][\p{L}\p{N}+.#-]*/gu)) {
        const start = match.index ?? 0;
        const raw = cleanToken(match[0]);
        const gap = source.slice(previousEnd, start);
        previousEnd = start + match[0].length;

        if (!raw) {
            continue;
        }

        const key = stripDiacritics(raw).toLowerCase().replace(/[.-]/g, '');
        if (!key) {
            continue;
        }

        tokens.push({
            raw,
            key,
            breakBefore: tokens.length > 0 && (previousEndedSentence || PHRASE_BREAK.test(gap)),
        });
        // Un token escrito con punto final ("Java.") cierra la oración
        previousEndedSentence = match[0].endsWith('.');
    }

    return tokens;
}

/**
 * Clave de comparación de un término: insensible a mayúsculas, acentos y separadores.
 * "Node.js", "NodeJS" y "node js" dan "nodejs"; "Front-End" y "front end" dan "frontend".
 */
export function aliasKey(term: string): string {
    return tokenizeText(term).map((token) => token.key).join('');
}

export interface AliasEntry {
    keywordId: string;
    /**
     * Para alias que también son palabras comunes ("Go", "R", "Swift"): en texto libre
     * solo coincide si el token está escrito exactamente así.
     */
    exactText?: string | null;
}

export type AliasIndex = Map<string, AliasEntry>;

export interface Mention {
    keywordId: string;
    /** Posición del primer token de la coincidencia. */
    start: number;
    /** Cantidad de tokens que abarca. */
    size: number;
}

/**
 * Coincidencias del diccionario en una secuencia de tokens. Recorre de izquierda a derecha
 * y en cada posición se queda con el alias más largo, sin solapar.
 */
export function findMentions(tokens: TextToken[], index: AliasIndex): Mention[] {
    const mentions: Mention[] = [];

    let position = 0;
    while (position < tokens.length) {
        let consumed = 0;

        for (let size = Math.min(MAX_ALIAS_WORDS, tokens.length - position); size >= 1; size--) {
            const span = tokens.slice(position, position + size);
            if (span.slice(1).some((token) => token.breakBefore)) {
                continue;
            }

            const entry = index.get(span.map((token) => token.key).join(''));
            if (!entry) {
                continue;
            }
            if (entry.exactText && (size > 1 || span[0].raw !== entry.exactText)) {
                continue;
            }

            mentions.push({ keywordId: entry.keywordId, start: position, size });
            consumed = size;
            break;
        }

        position += consumed || 1;
    }

    return mentions;
}

/** Keywords del diccionario mencionadas en un texto, con la cantidad de menciones de cada una. */
export function matchText(text: string, index: AliasIndex): Map<string, number> {
    const counts = new Map<string, number>();
    for (const mention of findMentions(tokenizeText(text), index)) {
        counts.set(mention.keywordId, (counts.get(mention.keywordId) ?? 0) + 1);
    }
    return counts;
}

export interface TextIndex {
    /** Claves de todas las frases de hasta MAX_ALIAS_WORDS palabras del texto. */
    keys: Set<string>;
    /** Tokens tal como están escritos, para los alias que exigen capitalización exacta. */
    rawTokens: Set<string>;
}

/** Prepara un texto para preguntar muchas veces si menciona un término (ver `textMentions`). */
export function buildTextIndex(text: string): TextIndex {
    const tokens = tokenizeText(text);
    const keys = new Set<string>();
    const rawTokens = new Set<string>();

    for (let position = 0; position < tokens.length; position++) {
        rawTokens.add(tokens[position].raw);

        let key = '';
        for (let size = 1; size <= MAX_ALIAS_WORDS && position + size <= tokens.length; size++) {
            const token = tokens[position + size - 1];
            if (size > 1 && token.breakBefore) {
                break;
            }
            key += token.key;
            keys.add(key);
        }
    }

    return { keys, rawTokens };
}

/** true si el texto indexado menciona el alias (como frase contigua, no como palabras sueltas). */
export function textMentions(textIndex: TextIndex, alias: { aliasText: string; exactText?: string | null }): boolean {
    if (alias.exactText) {
        return textIndex.rawTokens.has(alias.exactText);
    }
    return alias.aliasText.length > 0 && textIndex.keys.has(alias.aliasText);
}
