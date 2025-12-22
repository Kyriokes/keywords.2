import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import PDFParser from 'pdf2json';

// Función helper para extraer keywords (misma lógica que antes)
const extractKeywords = (text: string): string[] => {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  return Array.from(new Set(words));
};

// Función para decodificar texto de pdf2json (a veces viene encodeado)
const decodeText = (text: string) => {
  return decodeURIComponent(text);
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileType = file.name.split('.').pop()?.toLowerCase();
    let text = '';

    if (fileType === 'pdf') {
      try {
        text = await new Promise((resolve, reject) => {
          const pdfParser = new PDFParser(null, 1); // 1 = text only

          pdfParser.on("pdfParser_dataError", (errData: any) => {
            console.error("PDF Parser Error:", errData.parserError);
            reject(new Error(errData.parserError));
          });

          pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
             // pdf2json devuelve un objeto complejo. Usamos getRawTextContent() si está disponible o procesamos manualmente
             // getRawTextContent() es lo más directo
             const rawText = pdfParser.getRawTextContent();
             resolve(rawText);
          });

          // Iniciar el parseo del buffer
          pdfParser.parseBuffer(buffer);
        });
      } catch (pdfError) {
        console.error('PDF Parse specific error:', pdfError);
        throw pdfError;
      }
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
      { error: 'Failed to parse file' },
      { status: 500 }
    );
  }
}
