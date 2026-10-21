// Por qué el usuario descarta una oferta. Sin Prisma: lo importan los componentes y las herramientas del agente.

export const SKIP_REASONS = [
    "TECH",
    "LANGUAGE",
    "LOCATION",
    "NOT_A_JOB",
    "CLOSED",
    "DUPLICATE",
    "SENIORITY",
    "SALARY",
    "COMPANY",
    "OTHER",
] as const;

export type SkipReason = typeof SKIP_REASONS[number];

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
    TECH: "Tecnología que no tenés",
    LANGUAGE: "Pide otro idioma",
    LOCATION: "Ubicación o modalidad",
    NOT_A_JOB: "No es una vacante real",
    CLOSED: "Oferta cerrada",
    DUPLICATE: "Repetida",
    SENIORITY: "Nivel o años pedidos",
    SALARY: "Sueldo bajo",
    COMPANY: "Empresa que no te interesa",
    OTHER: "Otro motivo",
};

export function isSkipReason(value: unknown): value is SkipReason {
    return typeof value === "string" && Object.hasOwn(SKIP_REASON_LABELS, value);
}

/** Línea que queda en las notas de la oferta: "Descartada: Tecnología que no tenés (Go)"; sin motivo, "Descartada". */
export function skipNote(reason: SkipReason | undefined, detail: string | undefined): string {
    const label = reason ? `Descartada: ${SKIP_REASON_LABELS[reason]}` : "Descartada";
    return detail?.trim() ? `${label} (${detail.trim()})` : label;
}
