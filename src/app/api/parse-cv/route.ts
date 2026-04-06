export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

const STOPWORDS = new Set([
    'experience', 'experiencia', 'years', 'anos', 'worked', 'trabajado', 'company', 'empresa',
    'role', 'rol', 'project', 'proyecto', 'projects', 'proyectos', 'responsible', 'responsable',
    'responsibilities', 'responsabilidades', 'professional', 'profesional', 'work', 'trabajo',
    'working', 'trabajando', 'profile', 'perfil', 'resume', 'curriculum', 'contact', 'contacto',
    'phone', 'telefono', 'email', 'correo', 'address', 'direccion', 'city', 'ciudad',
    'country', 'pais', 'date', 'fecha', 'sergio',
    'de', 'of', 'la', 'el', 'los', 'las', 'the',
    'y', 'and', 'o', 'or', 'en', 'in', 'con', 'with', 'por', 'by', 'para', 'for',
    'una', 'un', 'a', 'del', 'al', 'to',
    'como', 'as', 'entre', 'between', 'sin', 'without', 'sobre', 'about',
    'mas', 'more', 'menos', 'less'
]);

const PERSONAL_DATA_STOPWORDS = new Set([
    'nombre', 'apellido', 'name', 'surname',
    'email', 'correo', 'telefono', 'phone', 'contacto', 'contact',
    'direccion', 'address', 'ciudad', 'city', 'pais', 'country',
    'linkedin', 'portfolio', 'curriculum', 'cv'
]);

const PHRASE_DICTIONARY: string[] = [
    'natural language processing',
    'computer vision',
    'machine learning',
    'deep learning',
    'data science'
];

const CANONICAL_MAP: Record<string, string> = {
    'node js': 'nodejs',
    'node.js': 'nodejs',
    'nodejs': 'nodejs',
    'react js': 'react',
    'react.js': 'react',
    'reactjs': 'react',
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'c sharp': 'c#',
    'c#': 'c#',
    'c plus plus': 'c++',
    'c++': 'c++',
    's q l': 'sql',
    'sql': 'sql',
    'nlp': 'natural language processing'
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalizeTechnicalText(input: string): string {
    let text = input.normalize('NFKC');
    text = text.normalize('NFD').replace(/\p{M}+/gu, '');
    text = text.toLowerCase();
    text = text.replace(/[^\p{L}\p{N}\s+.#-]/gu, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

type AcceptedPhraseSpan = { start: number; end: number; replacement: string };

function lexicalCompare(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

function sortPhrasesDeterministically(phrases: string[]): string[] {
    return [...phrases].sort((a, b) => {
        if (a.length !== b.length) {
            return b.length - a.length;
        }
        return lexicalCompare(a, b);
    });
}

function spansOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd;
}

function preprocessPhrases(text: string): string {
    const sortedPhrases = sortPhrasesDeterministically(PHRASE_DICTIONARY);
    const acceptedSpans: AcceptedPhraseSpan[] = [];

    for (const phrase of sortedPhrases) {
        const regex = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, 'gu');
        for (const match of text.matchAll(regex)) {
            const full = match[0] || '';
            if (!full) {
                continue;
            }
            const baseIndex = typeof match.index === 'number' ? match.index : -1;
            if (baseIndex < 0) {
                continue;
            }
            const leadingLength = match[1] ? match[1].length : 0;
            const start = baseIndex + leadingLength;
            const end = start + phrase.length;
            const hasOverlap = acceptedSpans.some(span => spansOverlap(start, end, span.start, span.end));
            if (hasOverlap) {
                continue;
            }
            acceptedSpans.push({ start, end, replacement: phrase });
        }
    }

    const orderedSpans = [...acceptedSpans].sort((a, b) => a.start - b.start);
    let cursor = 0;
    let output = '';
    for (const span of orderedSpans) {
        output += text.slice(cursor, span.start);
        output += span.replacement;
        cursor = span.end;
    }
    output += text.slice(cursor);
    return output;
}

function tokenize(text: string): string[] {
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

function cleanToken(token: string): string {
    return token
        .replace(/^[\s"'`([{<]+/, '')
        .replace(/[\s"'`)\]}>.,;:!?]+$/, '')
        .replace(/\.{2,}$/, '');
}

function isPersonalDataPattern(token: string): boolean {
    if (!token) {
        return false;
    }
    if (/@/.test(token)) {
        return true;
    }
    if (/(gmail|hotmail|outlook|yahoo)/.test(token)) {
        return true;
    }
    if (/(http|https|www|\.com|\.net|\.org|\.io|\.dev)/.test(token)) {
        return true;
    }
    if (/\d{6,}/.test(token)) {
        return true;
    }
    if (token === 'cp' || token === 'zip' || token === 'av' || token === 'calle' || token === 'street' || token === 'st') {
        return true;
    }
    return false;
}

function filterToken(token: string): boolean {
    if (token.length === 0) {
        return false;
    }
    if (/\d/.test(token)) {
        return false;
    }
    if (PERSONAL_DATA_STOPWORDS.has(token)) {
        return false;
    }
    if (isPersonalDataPattern(token)) {
        return false;
    }
    if (STOPWORDS.has(token)) {
        return false;
    }
    if (token.length < 3) {
        return false;
    }
    if (/^[+#.-]+$/.test(token)) {
        return false;
    }
    return true;
}

function canonicalizeToken(token: string): string {
    return Object.prototype.hasOwnProperty.call(CANONICAL_MAP, token) ? CANONICAL_MAP[token] : token;
}

function countOccurrences(canonicalTokens: string[]): Record<string, number> {
    const keywordCounts: Record<string, number> = {};
    for (const token of canonicalTokens) {
        if (!Object.prototype.hasOwnProperty.call(keywordCounts, token)) {
            keywordCounts[token] = 1;
            continue;
        }
        keywordCounts[token] += 1;
    }
    return keywordCounts;
}

function dedupeByFirstOccurrence(canonicalTokens: string[]): string[] {
    const orderedSet = new Set<string>();
    for (const token of canonicalTokens) {
        orderedSet.add(token);
    }
    return Array.from(orderedSet);
}

function runKeywordPipeline(text: string): { keywords: string[]; keywordCounts: Record<string, number> } {
    const normalizedText = normalizeTechnicalText(text);
    const preprocessedText = preprocessPhrases(normalizedText);
    const tokenized = tokenize(preprocessedText);
    const cleaned = tokenized.map(cleanToken);
    const filtered = cleaned.filter(filterToken);
    const canonicalTokens = filtered.map(canonicalizeToken);
    const keywordCounts = countOccurrences(canonicalTokens);
    const keywords = dedupeByFirstOccurrence(canonicalTokens);
    return { keywords, keywordCounts };
}

// Reconstrucción robusta de texto desde pdf2json (todas las páginas, todos los runs)
async function parsePdfWithPdf2json(buffer: Buffer): Promise<{ text: string; pagesCount: number }> {
    const mod = await import('pdf2json');
    const PDFParser = (mod as any).default || (mod as any);
    const parser = new PDFParser();

    return await new Promise((resolve, reject) => {
        parser.on('pdfParser_dataReady', (data: any) => {
            const pages = Array.isArray(data?.Pages) ? data.Pages : [];
            const pageTexts = pages.map((p: any) => {
                const texts = Array.isArray(p?.Texts) ? p.Texts : [];
                const items = texts.map((t: any) => {
                    const runs = Array.isArray(t?.R) ? t.R : [];
                    const str = runs
                        .map((r: any) => {
                            const raw = r?.T || '';
                            try {
                                return decodeURIComponent(raw);
                            } catch {
                                return raw;
                            }
                        })
                        .join('');
                    const x = typeof t?.x === 'number' ? t.x : 0;
                    const y = typeof t?.y === 'number' ? t.y : 0;
                    return { x, y, str };
                });

                // Agrupar por línea usando y redondeado, ordenar por x y concatenar con espacios por gaps
                const rows = new Map<number, Array<{ x: number; str: string }>>();
                for (const it of items) {
                    const yKey = Math.round(it.y * 10); // tolerancia de línea
                    const arr = rows.get(yKey) || [];
                    arr.push({ x: it.x, str: it.str });
                    rows.set(yKey, arr);
                }
                const gapThreshold = 1.2; // espacio cuando hay salto significativo en x
                const lines = Array.from(rows.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([, row]) => {
                        row.sort((a, b) => a.x - b.x);
                        let line = '';
                        let prevX: number | null = null;
                        for (const token of row) {
                            if (prevX !== null && token.x - prevX > gapThreshold) {
                                line += ' ';
                            }
                            line += token.str;
                            prevX = token.x;
                        }
                        return line;
                    });

                return lines.join('\n');
            });

            const combined = pageTexts.join('\n');
            resolve({ text: combined, pagesCount: pages.length || 0 });
        });
        parser.on('pdfParser_dataError', (err: any) => reject(err?.parserError || err));
        parser.parseBuffer(buffer);
    });
}

export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get('content-type') || '';

        if (!contentType.includes('multipart/form-data')) {
            return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!(file instanceof Blob)) {
            return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
        }

        const ab = await file.arrayBuffer();
        const buffer = Buffer.from(ab);
        const fileType = (file as any).name?.split('.').pop()?.toLowerCase();
        let text = '';

        if (fileType === 'pdf') {
            if (buffer.length === 0) {
                return NextResponse.json({ error: 'Empty PDF payload' }, { status: 400 });
            }
            const { text: rawText } = await parsePdfWithPdf2json(buffer);
            text = rawText
                .replace(/\n\s*\n/g, '\n')
                .replace(/[ \t]+/g, ' ');
        } else if (fileType === 'docx') {
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        } else {
            return NextResponse.json(
                { error: 'Unsupported file format. Please upload PDF or DOCX.' },
                { status: 400 }
            );
        }

        const { keywords, keywordCounts } = runKeywordPipeline(text);

        return NextResponse.json({ text, keywords, keywordCounts });

    } catch (error) {
        console.error('Error parsing CV:', error);
        return NextResponse.json(
            { error: 'Failed to parse file', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
