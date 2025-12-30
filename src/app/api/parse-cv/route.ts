export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

// Función helper para extraer keywords (misma lógica que antes)
const extractKeywords = (text: string): string[] => {
    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);

    return Array.from(new Set(words));
};

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
                    .map(([_, row]) => {
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

// Heurística mínima para acrónimos y tokens comunes
function normalizeAcronyms(input: string): string {
    return input
        .replace(/\bC\s+#\b/g, 'C#')
        .replace(/\bH\s+TML\b/g, 'HTML')
        .replace(/\bC\s+SS\b/g, 'CSS')
        .replace(/\bS\s+QL\b/g, 'SQL')
        .replace(/\bJ\s+S\b/g, 'JS')
        .replace(/\bG\s+IT\b/g, 'GIT')
        .replace(/\bG\s+itHub\b/gi, 'GitHub');
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
            text = normalizeAcronyms(
                rawText
                    .replace(/\n\s*\n/g, '\n')
                    .replace(/[ \t]+/g, ' ')
            );
        } else if (fileType === 'docx') {
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        } else {
            return NextResponse.json(
                { error: 'Unsupported file format. Please upload PDF or DOCX.' },
                { status: 400 }
            );
        }

        const keywords = extractKeywords(text);

        return NextResponse.json({ text, keywords });

    } catch (error) {
        console.error('Error parsing CV:', error);
        return NextResponse.json(
            { error: 'Failed to parse file', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
