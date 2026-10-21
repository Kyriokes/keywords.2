import "server-only";

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { DEFAULT_WORK_MODES } from "./eligibility";
import { AGGREGATOR_SOURCES } from "./sources";

/** Configuración de la búsqueda de un perfil, con valores por defecto cuando todavía no guardó nada. */
export interface SearchSettings {
    enabled: boolean;
    sources: string[];
    atsBoards: string[];
    minScore: number;
    maxPerRun: number;
    workModes: string[];
    seniorityPolicy: string;
    minRelocationSalaryUsd: number | null;
    autoApproveMinScore: number | null;
    minSalaryUsdMonthly: number | null;
    minSalaryArsMonthly: number | null;
    maxPerCompanyPerMonth: number;
    lastRunAt: Date | null;
    lastResult: string | null;
}

/** Reglas que se pueden cambiar desde el chat, además del panel. */
export type SearchRules = Pick<SearchSettings, "autoApproveMinScore" | "minSalaryUsdMonthly" | "minSalaryArsMonthly" | "maxPerCompanyPerMonth">;

export const SEARCH_DEFAULTS: Omit<SearchSettings, "lastRunAt" | "lastResult"> = {
    enabled: false,
    // Computrabajo es solo para Argentina y se postula a mano: cada usuario lo marca si le sirve
    sources: AGGREGATOR_SOURCES.filter((source) => source !== "computrabajo"),
    atsBoards: [],
    minScore: 40,
    maxPerRun: 40,
    workModes: [...DEFAULT_WORK_MODES],
    seniorityPolicy: "FLEXIBLE",
    minRelocationSalaryUsd: null,
    autoApproveMinScore: null,
    minSalaryUsdMonthly: null,
    minSalaryArsMonthly: null,
    maxPerCompanyPerMonth: 2,
};

/** Lo que necesita la búsqueda de cada perfil; lo usa el cron para traer a todos de una vez. */
export const SEARCH_SETTINGS_SELECT = {
    profileId: true,
    sources: true,
    atsBoards: true,
    minScore: true,
    maxPerRun: true,
    workModes: true,
    seniorityPolicy: true,
    minRelocationSalaryUsd: true,
    autoApproveMinScore: true,
    minSalaryUsdMonthly: true,
    maxPerCompanyPerMonth: true,
} satisfies Prisma.JobSearchSettingsSelect;

/** La configuración guardada o, si no hay, los valores por defecto (`exists` dice cuál de las dos). */
export async function loadSearchSettings(profileId: string): Promise<SearchSettings & { exists: boolean }> {
    const settings = await prisma.jobSearchSettings.findUnique({ where: { profileId } });
    if (!settings) return { ...SEARCH_DEFAULTS, lastRunAt: null, lastResult: null, exists: false };
    return {
        enabled: settings.enabled,
        sources: settings.sources,
        atsBoards: settings.atsBoards,
        minScore: settings.minScore,
        maxPerRun: settings.maxPerRun,
        workModes: settings.workModes,
        seniorityPolicy: settings.seniorityPolicy,
        minRelocationSalaryUsd: settings.minRelocationSalaryUsd,
        autoApproveMinScore: settings.autoApproveMinScore,
        minSalaryUsdMonthly: settings.minSalaryUsdMonthly,
        minSalaryArsMonthly: settings.minSalaryArsMonthly,
        maxPerCompanyPerMonth: settings.maxPerCompanyPerMonth,
        lastRunAt: settings.lastRunAt,
        lastResult: settings.lastResult,
        exists: true,
    };
}

/** Cambia solo las reglas que vienen; si el perfil no tenía configuración, la crea con los defaults. */
export async function updateSearchRules(profileId: string, rules: Partial<SearchRules>): Promise<SearchRules> {
    const data = Object.fromEntries(Object.entries(rules).filter(([, value]) => value !== undefined)) as Partial<SearchRules>;
    const saved = await prisma.jobSearchSettings.upsert({
        where: { profileId },
        create: { profileId, ...SEARCH_DEFAULTS, ...data },
        update: data,
        select: { autoApproveMinScore: true, minSalaryUsdMonthly: true, minSalaryArsMonthly: true, maxPerCompanyPerMonth: true },
    });
    return saved;
}
