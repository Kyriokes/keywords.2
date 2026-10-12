import "server-only";

const hits = new Map<string, number[]>();

/**
 * Límite simple por clave con ventana deslizante. Vive en la memoria del proceso:
 * con varias instancias cada una cuenta por separado, así que es un freno básico, no una garantía.
 */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

    const limited = recent.length >= max;
    if (!limited) recent.push(now);
    hits.set(key, recent);
    return limited;
}
