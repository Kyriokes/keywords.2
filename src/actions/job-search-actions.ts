'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { suggestAtsBoards, type BoardSuggestion } from "@/lib/ingest/boards"
import { DEFAULT_WORK_MODES } from "@/lib/ingest/eligibility"
import { runJobSearch, runSavedSearch, type SearchDecision } from "@/lib/ingest/run"
import { AGGREGATOR_SOURCES, parseAtsBoard } from "@/lib/ingest/sources"
import { isRateLimited } from "@/lib/rateLimit"
import { LIMITS, firstIssueMessage, jobSearchSettingsSchema, type ActionResult } from "@/lib/validation"

export interface JobSearchSettingsData {
  enabled: boolean
  sources: string[]
  atsBoards: string[]
  minScore: number
  maxPerRun: number
  workModes: string[]
  seniorityPolicy: string
  lastRunAt: string | null
  lastResult: string | null
  /** Empresas que aparecen en los links de las ofertas y todavía no se siguen. */
  suggestedBoards: BoardSuggestion[]
}

// Ofertas recientes que se miran para sugerir empresas
const SUGGESTION_SAMPLE = 1_000

type EditableSettings = Pick<
  JobSearchSettingsData,
  "enabled" | "sources" | "atsBoards" | "minScore" | "maxPerRun" | "workModes" | "seniorityPolicy"
>

// Probar filtros consulta las mismas APIs pero no guarda nada: unas pocas veces cada 10 minutos
const PREVIEW_MAX = 5
const PREVIEW_WINDOW_MS = 10 * 60 * 1000

const DEFAULTS = {
  enabled: false,
  sources: [...AGGREGATOR_SOURCES],
  atsBoards: [] as string[],
  minScore: 40,
  maxPerRun: 40,
  workModes: [...DEFAULT_WORK_MODES] as string[],
  seniorityPolicy: "FLEXIBLE"
}

async function requireProfileId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  })
  if (!profile) throw new Error("Profile not found")
  return profile.id
}

/** Valida la configuración del panel; la comparten guardar y probar filtros. */
function parseSettings(data: EditableSettings): ActionResult<EditableSettings> {
  const parsed = jobSearchSettingsSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  const input = parsed.data

  const invalid = input.atsBoards.filter((board) => !parseAtsBoard(board))
  if (invalid.length) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: `No reconozco: ${invalid.join(", ")}. Usá el formato greenhouse:empresa, lever:empresa, ashby:empresa, workable:empresa o smartrecruiters:empresa.`
    }
  }
  if (input.atsBoards.length > LIMITS.atsBoards) {
    return { ok: false, code: "INVALID_INPUT", message: `Podés seguir hasta ${LIMITS.atsBoards} empresas.` }
  }

  return {
    ok: true,
    data: {
      ...input,
      sources: input.sources.filter((source) => (AGGREGATOR_SOURCES as readonly string[]).includes(source))
    }
  }
}

export async function getJobSearchSettings(): Promise<JobSearchSettingsData> {
  const profileId = await requireProfileId()
  const [settings, offers] = await Promise.all([
    prisma.jobSearchSettings.findUnique({ where: { profileId } }),
    // Las más recientes alcanzan para ver de qué empresas vienen las ofertas; las descartadas no cuentan
    prisma.jobApplication.findMany({
      where: { profileId, status: { not: "SKIPPED" } },
      orderBy: { date: "desc" },
      take: SUGGESTION_SAMPLE,
      select: { link: true, applyUrl: true }
    })
  ])
  const suggestedBoards = suggestAtsBoards(
    offers.map((offer) => [offer.link, offer.applyUrl]),
    settings?.atsBoards ?? []
  )
  if (!settings) return { ...DEFAULTS, lastRunAt: null, lastResult: null, suggestedBoards }
  return {
    enabled: settings.enabled,
    sources: settings.sources,
    atsBoards: settings.atsBoards,
    minScore: settings.minScore,
    maxPerRun: settings.maxPerRun,
    workModes: settings.workModes,
    seniorityPolicy: settings.seniorityPolicy,
    lastRunAt: settings.lastRunAt?.toISOString() ?? null,
    lastResult: settings.lastResult,
    suggestedBoards
  }
}

export async function saveJobSearchSettings(data: EditableSettings): Promise<ActionResult> {
  const profileId = await requireProfileId()
  const parsed = parseSettings(data)
  if (!parsed.ok) return parsed

  await prisma.jobSearchSettings.upsert({
    where: { profileId },
    create: { profileId, ...parsed.data },
    update: parsed.data
  })
  revalidatePath("/user/queue")
  return { ok: true, data: undefined }
}

/** Corre la búsqueda ahora mismo para el usuario, sin esperar al cron. */
export async function runJobSearchNow(): Promise<ActionResult<{ summary: string; created: number }>> {
  const profileId = await requireProfileId()
  const result = await runSavedSearch(profileId)
  if (result.ok) revalidatePath("/user/queue")
  return result
}

/**
 * Prueba los filtros con la configuración del panel (aunque no esté guardada): busca como siempre
 * pero no carga nada en la cola. Devuelve qué entraría y por qué se descartó cada oferta.
 */
export async function previewJobSearch(
  data: EditableSettings
): Promise<ActionResult<{ summary: string; decisions: SearchDecision[]; errors: string[] }>> {
  const profileId = await requireProfileId()
  const parsed = parseSettings(data)
  if (!parsed.ok) return parsed

  if (isRateLimited(`job-search-preview:${profileId}`, PREVIEW_MAX, PREVIEW_WINDOW_MS)) {
    return { ok: false, code: "TOO_SOON", message: "Probaste los filtros varias veces seguidas. Esperá unos minutos." }
  }

  const result = await runJobSearch(profileId, parsed.data, new Map(), { dryRun: true })
  return { ok: true, data: { summary: result.summary, decisions: result.decisions, errors: result.errors } }
}
