'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { approveReadyByScore } from "@/lib/applications/bulkApprove"
import { generateCoverLetterForApplication } from "@/lib/applications/coverLetter"
import { skipApplications, type Learned } from "@/lib/applications/skip"
import type { SkipReason } from "@/lib/applications/skipReasons"
import { LIMITS, skipReasonSchema, type ActionResult } from "@/lib/validation"

/** Estados que se ven en la cola de postulaciones asistidas. */
const QUEUE_STATUSES = ["READY", "APPROVED", "NEEDS_USER"] as const

const MAX_ITEMS = 200

export interface QueueItem {
  id: string
  date: string
  jobTitle: string
  company: string | null
  link: string | null
  applyUrl: string | null
  applyMode: string | null
  score: number | null
  status: string
  notes: string | null
  appliedAt: string | null
  coverLetter: string | null
  cvVariantName: string | null
  answers: { question: string; answer: string }[]
}

export interface QueueData {
  pending: QueueItem[]
  /** Postulaciones que envió Claude (tienen fecha de envío o respuestas registradas). */
  submitted: QueueItem[]
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

/**
 * Aprueba de una vez las ofertas por aprobar con match igual o mayor a `minScore`. La carta de cada
 * una se genera recién cuando el formulario la pide (o a mano desde la tarjeta).
 */
export async function approveQueueByScore(minScore: number): Promise<ActionResult<{ approved: number }>> {
  const profileId = await requireProfileId()
  if (!Number.isInteger(minScore) || minScore < 0 || minScore > 100) {
    return { ok: false, code: "INVALID_INPUT", message: "El match tiene que ser un número entre 0 y 100." }
  }

  const ids = await approveReadyByScore(profileId, minScore)
  revalidatePath("/user/queue")
  return { ok: true, data: { approved: ids.length } }
}

/**
 * Descarta una oferta de la cola guardando por qué. Un descarte por tecnología o por empresa queda
 * como preferencia y la búsqueda deja de traer esas ofertas; `learned` dice qué se aprendió.
 */
export async function skipApplication(
  id: string,
  reason?: SkipReason,
  detail?: string
): Promise<ActionResult<{ learned: Learned[] }>> {
  const profileId = await requireProfileId()
  const parsed = skipReasonSchema.safeParse({ reason, detail })
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: "El motivo del descarte no es válido." }

  const result = await skipApplications(profileId, [{ id, ...parsed.data }], QUEUE_STATUSES)
  if (result.skipped.length === 0) return { ok: false, code: "NOT_FOUND", message: "La oferta ya no está en la cola." }
  revalidatePath("/user/queue")
  revalidatePath("/user/dashboard")
  return { ok: true, data: { learned: result.learned } }
}

/** Genera (o regenera) con la IA el borrador de la carta de una oferta. */
export async function generateApplicationCoverLetter(id: string): Promise<ActionResult<{ text: string }>> {
  const profileId = await requireProfileId()
  const result = await generateCoverLetterForApplication(profileId, id, { overwrite: true })
  if (result.ok) revalidatePath("/user/queue")
  return result
}

/** Guarda la carta editada por el usuario; es la que Claude va a usar al postular. */
export async function saveApplicationCoverLetter(id: string, text: string): Promise<ActionResult> {
  const profileId = await requireProfileId()
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, code: "INVALID_INPUT", message: "La carta no puede estar vacía." }
  if (trimmed.length > LIMITS.coverLetter) {
    return { ok: false, code: "INVALID_INPUT", message: "La carta es demasiado larga." }
  }

  const application = await prisma.jobApplication.findFirst({ where: { id, profileId }, select: { id: true } })
  if (!application) return { ok: false, code: "NOT_FOUND", message: "La oferta ya no existe." }

  await prisma.coverLetter.upsert({
    where: { applicationId: id },
    create: { profileId, applicationId: id, text: trimmed },
    update: { text: trimmed }
  })
  revalidatePath("/user/queue")
  return { ok: true, data: undefined }
}

export async function getQueue(): Promise<QueueData> {
  const session = await auth()
  if (!session?.user?.id) return { pending: [], submitted: [] }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  })
  if (!profile) return { pending: [], submitted: [] }

  const select = {
    id: true,
    date: true,
    jobTitle: true,
    company: true,
    link: true,
    applyUrl: true,
    applyMode: true,
    score: true,
    status: true,
    notes: true,
    appliedAt: true,
    coverLetter: { select: { text: true } },
    cvVariant: { select: { name: true } },
    answers: { select: { question: true, answer: true }, orderBy: { createdAt: "asc" as const } }
  }

  const [pending, submitted] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { profileId: profile.id, status: { in: [...QUEUE_STATUSES] } },
      orderBy: [{ score: { sort: "desc", nulls: "last" } }, { date: "desc" }],
      take: MAX_ITEMS,
      select
    }),
    prisma.jobApplication.findMany({
      where: { profileId: profile.id, OR: [{ appliedAt: { not: null } }, { answers: { some: {} } }] },
      orderBy: [{ appliedAt: { sort: "desc", nulls: "last" } }, { date: "desc" }],
      take: MAX_ITEMS,
      select
    })
  ])

  const toItem = (app: (typeof pending)[number]): QueueItem => ({
    id: app.id,
    date: app.date.toISOString().split("T")[0],
    jobTitle: app.jobTitle,
    company: app.company,
    link: app.link,
    applyUrl: app.applyUrl,
    applyMode: app.applyMode,
    score: app.score,
    status: app.status,
    notes: app.notes,
    appliedAt: app.appliedAt?.toISOString() ?? null,
    coverLetter: app.coverLetter?.text ?? null,
    cvVariantName: app.cvVariant?.name ?? null,
    answers: app.answers
  })

  return { pending: pending.map(toItem), submitted: submitted.map(toItem) }
}
