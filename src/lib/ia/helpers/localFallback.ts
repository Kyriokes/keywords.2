import type { AiResponse } from "../types";

export function localFallback(combinedText: string): AiResponse {
    const lower = combinedText.toLowerCase();
    const words = lower.match(/\p{L}+/gu) || [];
    const counts = new Map<string, number>();
    words.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));

    const arr = Array.from(counts.entries())
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

    return { palabrasClave: arr.slice(0, 30) };
}

export function localFallbackAuto(combinedText: string, candidates: string[]): AiResponse {
    const base = localFallback(combinedText);
    const lowered = combinedText.toLowerCase();
    const match = candidates.find((p) => lowered.includes(p.toLowerCase()));
    return { ...base, puesto: match || "otros" };
}

export default localFallback;
