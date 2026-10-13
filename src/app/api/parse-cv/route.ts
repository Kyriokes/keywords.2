export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { auth } from '@/auth';
import { isRateLimited } from '@/lib/rateLimit';
import { detectKeywords } from '@/lib/keywords/dictionary';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_UPLOADS_PER_MINUTE = 10;

// Forma mínima de lo que usamos de pdf2json (el módulo se resuelve distinto según ESM/CJS)
interface PdfTextRun { T?: string }
interface PdfText { x?: number; y?: number; R?: PdfTextRun[] }
interface PdfPage { Texts?: PdfText[] }
interface PdfData { Pages?: PdfPage[] }
interface PdfParser {
    on(event: 'pdfParser_dataReady', handler: (data: PdfData) => void): void;
    on(event: 'pdfParser_dataError', handler: (err: { parserError?: unknown }) => void): void;
    parseBuffer(buffer: Buffer): void;
}

// Reconstrucción robusta de texto desde pdf2json (todas las páginas, todos los runs)
async function parsePdfWithPdf2json(buffer: Buffer): Promise<{ text: string; pagesCount: number }> {
    const mod: unknown = await import('pdf2json');
    const PDFParser = ((mod as { default?: unknown }).default || mod) as new () => PdfParser;
    const parser = new PDFParser();

    return await new Promise((resolve, reject) => {
        parser.on('pdfParser_dataReady', (data) => {
            const pages = Array.isArray(data?.Pages) ? data.Pages : [];
            const pageTexts = pages.map((p) => {
                const texts = Array.isArray(p?.Texts) ? p.Texts : [];
                const items = texts.map((t) => {
                    const runs = Array.isArray(t?.R) ? t.R : [];
                    const str = runs
                        .map((r) => {
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
        parser.on('pdfParser_dataError', (err) => reject(err?.parserError || err));
        parser.parseBuffer(buffer);
    });
}

function tooLargeResponse() {
    return NextResponse.json(
        { error: 'El archivo es demasiado grande. El límite es de 5MB.' },
        { status: 413 }
    );
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (isRateLimited(`parse-cv:${session.user.id}`, MAX_UPLOADS_PER_MINUTE, 60_000)) {
            return NextResponse.json(
                { error: 'Demasiados archivos en poco tiempo. Esperá un minuto e intentá de nuevo.' },
                { status: 429 }
            );
        }

        const contentType = req.headers.get('content-type') || '';

        if (!contentType.includes('multipart/form-data')) {
            return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
        }

        // Corte temprano por tamaño declarado, antes de leer el cuerpo completo en memoria
        if (Number(req.headers.get('content-length')) > MAX_FILE_SIZE + 1024 * 1024) {
            return tooLargeResponse();
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return tooLargeResponse();
        }

        const ab = await file.arrayBuffer();
        const buffer = Buffer.from(ab);
        const fileType = file.name.split('.').pop()?.toLowerCase();
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

        // Vista previa de lo que el diccionario reconoce; al guardar, el servidor lo recalcula desde el texto
        const keywords = (await detectKeywords(text)).map((keyword) => keyword.name);

        return NextResponse.json({ text, keywords });

    } catch (error) {
        console.error('Error parsing CV:', error);
        return NextResponse.json(
            { error: 'No se pudo leer el archivo. Verificá que sea un PDF o DOCX válido.' },
            { status: 500 }
        );
    }
}
