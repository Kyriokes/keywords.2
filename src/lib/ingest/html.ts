// HTML a texto plano, para las descripciones que los portales mandan con formato.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
        if (code[0] === "#") {
            const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return Number.isFinite(value) ? String.fromCodePoint(value) : match;
        }
        return ENTITIES[code.toLowerCase()] ?? match;
    });
}

/** HTML a texto plano conservando los saltos de párrafo y las viñetas. */
export function htmlToText(html: string): string {
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
