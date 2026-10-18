'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"

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
