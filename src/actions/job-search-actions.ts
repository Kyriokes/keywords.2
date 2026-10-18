'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { runAndRecord } from "@/lib/ingest/run"
import { AGGREGATOR_SOURCES, parseAtsBoard } from "@/lib/ingest/sources"
import { LIMITS, firstIssueMessage, jobSearchSettingsSchema, type ActionResult } from "@/lib/validation"

export interface JobSearchSettingsData {
  enabled: boolean
  sources: string[]
  atsBoards: string[]
  minScore: number
  maxPerRun: number
  lastRunAt: string | null
  lastResult: string | null
}

// Buscar a mano también consulta APIs ajenas: como mucho una vez por hora
const MANUAL_RUN_INTERVAL_MS = 60 * 60 * 1000

const DEFAULTS = {
  enabled: false,
  sources: [...AGGREGATOR_SOURCES],
  atsBoards: [] as string[],
  minScore: 40,
  maxPerRun: 10
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

export async function getJobSearchSettings(): Promise<JobSearchSettingsData> {
  const profileId = await requireProfileId()
  const settings = await prisma.jobSearchSettings.findUnique({ where: { profileId } })
  if (!settings) return { ...DEFAULTS, lastRunAt: null, lastResult: null }
  return {
    enabled: settings.enabled,
    sources: settings.sources,
    atsBoards: settings.atsBoards,
    minScore: settings.minScore,
    maxPerRun: settings.maxPerRun,
    lastRunAt: settings.lastRunAt?.toISOString() ?? null,
    lastResult: settings.lastResult
  }
}

export async function saveJobSearchSettings(
  data: Pick<JobSearchSettingsData, "enabled" | "sources" | "atsBoards" | "minScore" | "maxPerRun">
): Promise<ActionResult> {
  const profileId = await requireProfileId()
  const parsed = jobSearchSettingsSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  const input = parsed.data

  const invalid = input.atsBoards.filter((board) => !parseAtsBoard(board))
  if (invalid.length) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: `No reconozco: ${invalid.join(", ")}. Usá el formato greenhouse:empresa, lever:empresa o ashby:empresa.`
    }
  }
  if (input.atsBoards.length > LIMITS.atsBoards) {
    return { ok: false, code: "INVALID_INPUT", message: `Podés seguir hasta ${LIMITS.atsBoards} empresas.` }
  }

  const values = {
    enabled: input.enabled,
    sources: input.sources.filter((source) => (AGGREGATOR_SOURCES as readonly string[]).includes(source)),
    atsBoards: input.atsBoards,
    minScore: input.minScore,
    maxPerRun: input.maxPerRun
  }
  await prisma.jobSearchSettings.upsert({
    where: { profileId },
    create: { profileId, ...values },
    update: values
  })
  revalidatePath("/user/queue")
  return { ok: true, data: undefined }
}

/** Corre la búsqueda ahora mismo para el usuario, sin esperar al cron. */
export async function runJobSearchNow(): Promise<ActionResult<{ summary: string; created: number }>> {
  const profileId = await requireProfileId()
  const settings = await prisma.jobSearchSettings.findUnique({ where: { profileId } })
  if (!settings) return { ok: false, code: "NOT_CONFIGURED", message: "Guardá la configuración antes de buscar." }

  if (settings.lastRunAt && Date.now() - settings.lastRunAt.getTime() < MANUAL_RUN_INTERVAL_MS) {
    const minutes = Math.ceil((MANUAL_RUN_INTERVAL_MS - (Date.now() - settings.lastRunAt.getTime())) / 60_000)
    return { ok: false, code: "TOO_SOON", message: `Ya se buscó hace poco. Podés volver a buscar en ${minutes} min.` }
  }

  const result = await runAndRecord(profileId, settings)
  revalidatePath("/user/queue")
  return { ok: true, data: { summary: result.summary, created: result.created } }
}
