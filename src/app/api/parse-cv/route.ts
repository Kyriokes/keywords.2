export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

const SHORT_KEYWORD_ALLOWLIST = new Set([
    'ai', 'ml', 'qa', 'ui', 'ux', 'js', 'ts', 'go', 'aws', 'gcp', 'api', 'git', 'sql', 'c#', 'c++'
]);

const STOPWORDS = new Set([
    'experience', 'years', 'worked', 'company', 'role', 'project', 'projects', 'responsible',
    'responsibilities', 'professional', 'work', 'working'
]);

const PHRASE_DICTIONARY: Array<{ canonical: string; variants: string[] }> = [
    { canonical: 'nodejs', variants: ['node js', 'node.js', 'nodejs'] },
    { canonical: 'react', variants: ['react js', 'react.js', 'reactjs'] },
    { canonical: 'machine learning', variants: ['machine learning'] },
    { canonical: 'deep learning', variants: ['deep learning'] },
    { canonical: 'data science', variants: ['data science'] },
    { canonical: 'computer vision', variants: ['computer vision'] },
    { canonical: 'natural language processing', variants: ['natural language processing', 'nlp'] }
];

const PHRASE_REGEX_PATTERNS: Array<{ canonical: string; regex: RegExp }> = [
    { canonical: 'nodejs', regex: /\bnode\s*\.?\s*js\b/gi },
    { canonical: 'react', regex: /\breact\s*\.?\s*js\b/gi },
    { canonical: 'machine learning', regex: /\bmachine\s+learning\b/gi }
];

const CANONICAL_MAP = new Map<string, string>([
    ['node js', 'nodejs'],
    ['node.js', 'nodejs'],
    ['nodejs', 'nodejs'],
    ['react js', 'react'],
    ['react.js', 'react'],
    ['reactjs', 'react'],
    ['postgres', 'postgresql'],
    ['postgresql', 'postgresql'],
    ['c sharp', 'c#'],
    ['c#', 'c#'],
    ['c plus plus', 'c++'],
    ['c++', 'c++'],
    ['s q l', 'sql'],
    ['sql', 'sql']
]);

const CANONICAL_INDEX_ALIASES: Record<string, string[]> = {
    nodejs: ['nodejs', 'node js', 'node.js'],
    react: ['react', 'reactjs', 'react js', 'react.js'],
    postgresql: ['postgresql', 'postgres'],
    'machine learning': ['machine learning'],
    'deep learning': ['deep learning'],
    'data science': ['data science'],
    'computer vision': ['computer vision'],
    'natural language processing': ['natural language processing', 'nlp'],
    'c#': ['c#', 'c sharp'],
    'c++': ['c++', 'c plus plus']
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalizeTechnicalText(input: string): string {
    let text = input.normalize('NFKC');
    text = text
        .replace(/\bn\s*o\s*d\s*e\s*\.?\s*j\s*s\b/gi, ' nodejs ')
        .replace(/\br\s*e\s*a\s*c\s*t\s*\.?\s*j\s*s\b/gi, ' reactjs ')
        .replace(/\bc\s*\+\s*\+\b/gi, ' c++ ')
        .replace(/\bc\s*#\b/gi, ' c# ')
        .replace(/\bs\s*q\s*l\b/gi, ' sql ')
        .replace(/\bh\s*t\s*m\s*l\b/gi, ' html ')
        .replace(/\bc\s*s\s*s\b/gi, ' css ')
        .replace(/\ba\s*p\s*i\b/gi, ' api ')
        .replace(/\ba\s*w\s*s\b/gi, ' aws ')
        .replace(/\bg\s*c\s*p\b/gi, ' gcp ')
        .replace(/\bj\s*s\b/gi, ' js ')
        .replace(/\bt\s*s\b/gi, ' ts ')
        .replace(/\bg\s*i\s*t\b/gi, ' git ');
    text = text
        .replace(/[^\p{L}\p{N}\s+.#-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    return text;
}

function extractPhraseCandidates(text: string): string[] {
    const candidates = new Set<string>();
    for (const phrase of PHRASE_DICTIONARY) {
        for (const variant of phrase.variants) {
            const regex = new RegExp(`\\b${escapeRegExp(variant).replace(/\\\s+/g, '\\s+')}\\b`, 'gi');
            if (regex.test(text)) {
                candidates.add(phrase.canonical);
                break;
            }
        }
    }
    for (const entry of PHRASE_REGEX_PATTERNS) {
        if (entry.regex.test(text)) {
            candidates.add(entry.canonical);
        }
    }
    return Array.from(candidates);
}

function extractTokenCandidates(text: string): string[] {
    const tokens = text.match(/[a-z0-9][a-z0-9+.#-]*/g) || [];
    const candidates: string[] = [];
    for (const token of tokens) {
        const cleaned = token.replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/g, '');
        if (!cleaned) {
            continue;
        }
        if (cleaned.length > 2 || SHORT_KEYWORD_ALLOWLIST.has(cleaned) || /[+#]/.test(cleaned)) {
            candidates.push(cleaned);
        }
    }
    return candidates;
}

function canonicalizeKeyword(keyword: string): string {
    const normalized = keyword
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/g, '');
    if (!normalized) {
        return '';
    }
    return CANONICAL_MAP.get(normalized) || normalized;
}

function filterStopwords(keywords: string[]): string[] {
    return keywords.filter(keyword => {
        if (!keyword) {
            return false;
        }
        if (SHORT_KEYWORD_ALLOWLIST.has(keyword)) {
            return true;
        }
        return !STOPWORDS.has(keyword);
    });
}

function getFirstAppearanceIndex(keyword: string, originalText: string): number {
    const aliases = CANONICAL_INDEX_ALIASES[keyword] || [keyword];
    let first = Number.POSITIVE_INFINITY;
    for (const alias of aliases) {
        const regex = new RegExp(`\\b${escapeRegExp(alias).replace(/\\\s+/g, '\\s*')}\\b`, 'i');
        const match = originalText.match(regex);
        if (match && typeof match.index === 'number' && match.index < first) {
            first = match.index;
        }
    }
    return first;
}

function finalizeKeywords(keywords: string[], originalText: string): string[] {
    const unique = new Set<string>();
    for (const keyword of keywords) {
        if (keyword) {
            unique.add(keyword.toLowerCase());
        }
    }
    return Array.from(unique).sort((a, b) => {
        const aIndex = getFirstAppearanceIndex(a, originalText);
        const bIndex = getFirstAppearanceIndex(b, originalText);
        if (aIndex === bIndex) {
            return a.localeCompare(b);
        }
        if (Number.isFinite(aIndex) && Number.isFinite(bIndex)) {
            return aIndex - bIndex;
        }
        if (Number.isFinite(aIndex)) {
            return -1;
        }
        if (Number.isFinite(bIndex)) {
            return 1;
        }
        return a.localeCompare(b);
    });
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

        const normalizedTechnicalText = normalizeTechnicalText(text);
        const phraseCandidates = extractPhraseCandidates(normalizedTechnicalText);
        const tokenCandidates = extractTokenCandidates(normalizedTechnicalText);
        const canonicalizedKeywords = [...phraseCandidates, ...tokenCandidates].map(canonicalizeKeyword);
        const filteredKeywords = filterStopwords(canonicalizedKeywords);
        const keywords = finalizeKeywords(filteredKeywords, normalizedTechnicalText);

        return NextResponse.json({ text, keywords });

    } catch (error) {
        console.error('Error parsing CV:', error);
        return NextResponse.json(
            { error: 'Failed to parse file', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
