// HTML a texto plano, para las descripciones que los portales mandan con formato.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Un código que se puede escribir como carácter: no el nulo (la base no lo guarda) ni mitades de par sustituto. */
const isPrintableCodePoint = (value: number) =>
    Number.isInteger(value) && value > 0 && value <= 0x10ffff && (value < 0xd800 || value > 0xdfff);

export function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
        if (code[0] === "#") {
            const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            if (value === 0) return "";
            // Fuera de rango, String.fromCodePoint tira un error que cortaba la lectura de todo el portal
            return isPrintableCodePoint(value) ? String.fromCodePoint(value) : match;
        }
        return ENTITIES[code.toLowerCase()] ?? match;
    });
}

/** Saca los caracteres nulos: PostgreSQL no los acepta en un texto y la oferta no se podría guardar. */
export const stripNul = (text: string) => text.replace(/\u0000/g, "");

/** HTML a texto plano conservando los saltos de párrafo y las viñetas. */
export function htmlToText(rawHtml: string): string {
    const html = stripNul(rawHtml);
    // Greenhouse manda el HTML con las entidades escapadas (&lt;p&gt;): primero se decodifica
    const source = /&lt;\/?[a-z]/i.test(html) ? decodeEntities(html) : html;
    return decodeEntities(
        source
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
            .replace(/<li[^>]*>/gi, "\n• ")
            .replace(/<\/(p|div|h[1-6]|ul|ol)>|<br\s*\/?>/gi, "\n")
            .replace(/<[^>]+>/g, "")
    )
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*/g, "\n\n")
        .trim();
}
