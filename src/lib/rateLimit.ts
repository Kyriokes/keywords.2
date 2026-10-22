import "server-only";

interface Window {
    stamps: number[];
    windowMs: number;
}

const hits = new Map<string, Window>();

// Cada tanto se borran las claves sin pedidos recientes: sin esto el mapa crece con cada usuario y token
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

function sweep(now: number) {
    lastSweep = now;
    for (const [key, { stamps, windowMs }] of hits) {
        if (stamps.every((timestamp) => now - timestamp >= windowMs)) hits.delete(key);
    }
}

/**
 * Límite simple por clave con ventana deslizante. Vive en la memoria del proceso:
 * con varias instancias cada una cuenta por separado, así que es un freno básico, no una garantía.
 * `cost` es cuántos lugares ocupa el pedido (por ejemplo, un lote de varios mensajes).
 */
export function isRateLimited(key: string, max: number, windowMs: number, cost = 1): boolean {
    const now = Date.now();
    // También si el reloj retrocedió (un ajuste de hora): si no, la limpieza no volvería a correr
    if (now - lastSweep >= SWEEP_INTERVAL_MS || now < lastSweep) sweep(now);

    const recent = (hits.get(key)?.stamps ?? []).filter((timestamp) => now - timestamp < windowMs);
    const limited = recent.length + cost > max;
    if (!limited) for (let i = 0; i < cost; i++) recent.push(now);
    hits.set(key, { stamps: recent, windowMs });
    return limited;
}

/** Claves que el límite está siguiendo; solo para las pruebas. */
export function trackedKeys(): string[] {
    return Array.from(hits.keys());
}
