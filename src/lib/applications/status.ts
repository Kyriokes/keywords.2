// Nombres y colores de los estados de una postulación. Sin Prisma: lo importan los componentes.
import type { ApplicationStatusValue } from "@/lib/validation";

export const STATUS_LABELS: Record<ApplicationStatusValue, string> = {
    APPLIED: "Enviada",
    INTERVIEW: "Entrevista",
    SAVED: "Guardada",
    REJECTED: "Rechazada",
    READY: "En cola",
    APPROVED: "Aprobada",
    NEEDS_USER: "Requiere acción",
    SKIPPED: "Descartada",
};

export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as ApplicationStatusValue[]).map((value) => ({
    value,
    label: STATUS_LABELS[value],
}));

export const STATUS_COLOR_CLASS: Record<ApplicationStatusValue, string> = {
    APPLIED: "text-primary",
    INTERVIEW: "text-amber-600",
    SAVED: "text-muted-foreground",
    REJECTED: "text-red-600",
    READY: "text-muted-foreground",
    APPROVED: "text-primary",
    NEEDS_USER: "text-amber-600",
    SKIPPED: "text-muted-foreground",
};

export function isApplicationStatus(value: unknown): value is ApplicationStatusValue {
    return typeof value === "string" && Object.hasOwn(STATUS_LABELS, value);
}

/** Lo que elige el filtro del historial: un estado o todos. */
export type StatusFilter = ApplicationStatusValue | "all";

export const isStatusFilter = (value: unknown): value is StatusFilter => value === "all" || isApplicationStatus(value);
