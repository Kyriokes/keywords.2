import { LIMITS } from "@/lib/validation";

/**
 * Suma una línea a las notas de una oferta sin pisar lo anterior: el resumen del ingreso
 * ("Remoto · pide 3 años · match 58%") queda primero y debajo lo que pasó después
 * ("Enviada por Ashby…", "Descartada: …"). Una línea idéntica no se repite.
 */
export function appendNote(existing: string | null | undefined, line: string): string {
    const addition = line.trim();
    const base = existing?.trim() ?? "";
    if (!addition) return base;
    if (!base) return addition.slice(0, LIMITS.notes);
    if (base.split("\n").some((current) => current.trim() === addition)) return base;
    return `${base}\n${addition}`.slice(0, LIMITS.notes);
}
