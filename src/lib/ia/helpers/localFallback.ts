import type { AiResponse } from "../types";

export function localFallback(combinedText: string): AiResponse {
    const lower = combinedText.toLowerCase();
    const words = lower.match(/\p{L}+/gu) || [];
    const counts = new Map<string, number>();
    words.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));

    const arr = Array.from(counts.entries())
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

    const titleTokens = (words.slice(0, 4) || []).map(
        (t) => t[0].toUpperCase() + t.slice(1)
    );
    const titulo = titleTokens.join(" ") || combinedText.slice(0, 40);

    return { titulo, palabrasClave: arr.slice(0, 30) };
}

export default localFallback;
