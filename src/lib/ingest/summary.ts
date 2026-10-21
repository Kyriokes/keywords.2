// Las notas de una oferta que entra a la cola: lo que hace falta leer para decidir sin abrirla.

const DAY_MS = 24 * 60 * 60 * 1000;

/** "publicada hoy", "publicada ayer", "publicada hace 3 días"; undefined si no se sabe la fecha. */
export function publishedAgo(publishedAt: string | undefined, now: Date = new Date()): string | undefined {
    if (!publishedAt) return undefined;
    const time = Date.parse(publishedAt);
    if (!Number.isFinite(time)) return undefined;
    const days = Math.max(0, Math.floor((now.getTime() - time) / DAY_MS));
    if (days === 0) return "publicada hoy";
    if (days === 1) return "publicada ayer";
    return `publicada hace ${days} días`;
}

/** Cuántas tecnologías que faltan se nombran en las notas. */
const MAX_MISSING = 3;

export interface NotesInput {
    /** Resumen de la elegibilidad: "Remoto · Senior · pide 4 años". */
    summary: string;
    publishedAt?: string;
    score: number;
    /** Tecnologías del stack de la oferta que no están en el CV, de más a menos mencionadas. */
    missing: string[];
    warnings: string[];
}

/** "Remoto · publicada hace 2 días · match 58% · falta: Go, Kafka · menciona viajes". */
export function buildNotes(input: NotesInput, now: Date = new Date()): string {
    return [
        input.summary,
        publishedAgo(input.publishedAt, now),
        `match ${input.score}%`,
        input.missing.length ? `falta: ${input.missing.slice(0, MAX_MISSING).join(", ")}` : undefined,
        ...input.warnings,
    ]
        .filter(Boolean)
        .join(" · ");
}
