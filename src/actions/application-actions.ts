'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { providerManager } from "@/lib/ia/providerManager"
import { keywordName } from "@/lib/keywords/dictionary"
import { createApplicationForProfile } from "@/lib/applications/create"
import { parseApplicationStatus, type ActionResult } from "@/lib/validation"

export interface CreateApplicationData {
  jobTitle: string
  jobDescription: string
  link?: string
  detectedWords: string[]
  positionTitle?: string
  provider?: string
  /** El usuario ya revisó `detectedWords`: se guarda esa lista tal cual, sin sumarle nada. */
  reviewed?: boolean
  /** Fecha (AAAA-MM-DD) y estado originales, cuando la postulación viene de un respaldo. */
  date?: string
  status?: string
  company?: string
  applyUrl?: string
  applyMode?: string
}

// Lo que muestra el panel: todo menos la descripción, que puede pesar decenas de KB por oferta
// y con cientos de ofertas hacía lenta cada visita. Se pide aparte al abrir el detalle.
const listSelect = {
  id: true,
  date: true,
  jobTitle: true,
  link: true,
  status: true,
  provider: true,
  company: true,
  applyUrl: true,
  applyMode: true,
  source: true,
  score: true,
  notes: true,
  skipReason: true,
  skipDetail: true,
  seniority: true,
  originalPositionTitle: true,
  keywords: { select: { keyword: { select: { isBlocked: true, displayName: true, canonicalText: true } } } },
  position: { select: { title: true } },
  canonicalPosition: { select: { name: true } },
} satisfies Prisma.JobApplicationSelect

type ListedApplication = Prisma.JobApplicationGetPayload<{ select: typeof listSelect }>

async function requireProfileId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!profile) throw new Error("Profile not found")
  return profile.id
}

// Formato que espera el store del cliente
function toStoreApplication(app: ListedApplication & { jobDescription?: string }) {
  return {
    id: app.id,
    date: app.date.toISOString().split("T")[0],
    jobTitle: app.jobTitle,
    jobDescription: app.jobDescription,
    link: app.link || undefined,
    detectedWords: app.keywords.filter((k) => !k.keyword.isBlocked).map((k) => keywordName(k.keyword)),
    positionId: app.position?.title || app.originalPositionTitle || undefined,
    // Rol estandarizado y nivel, deducidos del título
    role: app.canonicalPosition?.name || undefined,
    seniority: app.seniority || undefined,
    provider: app.provider || undefined,
    status: app.status || "APPLIED",
    company: app.company || undefined,
    applyUrl: app.applyUrl || undefined,
    applyMode: app.applyMode || undefined,
    source: app.source || undefined,
    score: app.score ?? undefined,
    notes: app.notes || undefined,
    skipReason: app.skipReason || undefined,
    skipDetail: app.skipDetail || undefined
  }
}

export async function createApplication(
  data: CreateApplicationData
): Promise<ActionResult<ReturnType<typeof toStoreApplication>>> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  const result = await createApplicationForProfile(profile.id, data)
  if (!result.ok) return result
  const { application, provider } = result.data

  // Log acceptance if provider was used
  if (provider) {
    // Fire and forget
    providerManager.recordFeedback(profile.id, provider, 'accepted').catch(console.error)
  }

  revalidatePath('/user/dashboard')

  return { ok: true, data: toStoreApplication(application) }
}

export async function getApplications() {
    const session = await auth()
    if (!session?.user?.id) return []

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: {
        applications: {
            orderBy: { date: 'desc' },
            select: listSelect
        }
      }
    })

    if (!profile) return []

    return profile.applications.map((app) => toStoreApplication(app))
}

/** Descripción de una postulación del usuario, para el detalle del panel; null si no es suya o no existe. */
export async function getApplicationDescription(id: string): Promise<string | null> {
  const profileId = await requireProfileId()
  if (typeof id !== "string" || !id) return null
  const app = await prisma.jobApplication.findFirst({ where: { id, profileId }, select: { jobDescription: true } })
  return app?.jobDescription ?? null
}

/** Descripciones de todas las postulaciones del usuario, por id: solo para exportar el Excel. */
export async function getApplicationDescriptions(): Promise<Record<string, string>> {
  const profileId = await requireProfileId()
  const apps = await prisma.jobApplication.findMany({ where: { profileId }, select: { id: true, jobDescription: true } })
  return Object.fromEntries(apps.map((app) => [app.id, app.jobDescription]))
}

export async function deleteApplication(id: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id }
    })

    if (!profile) throw new Error("Profile not found")

    // Verify ownership
    const app = await prisma.jobApplication.findUnique({
        where: { id }
    })

    if (!app || app.profileId !== profile.id) {
        throw new Error("Unauthorized")
    }

    await prisma.jobApplication.delete({
        where: { id }
    })

    revalidatePath('/user/dashboard')
    return { success: true }
}

export async function clearApplications() {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id }
    })

    if (!profile) throw new Error("Profile not found")

    await prisma.jobApplication.deleteMany({
        where: { profileId: profile.id }
    })

    revalidatePath('/user/dashboard')
    return { success: true }
}

export async function updateApplicationStatus(id: string, status: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    if (!parseApplicationStatus(status)) {
      throw new Error("Invalid status")
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id }
    })

    if (!profile) throw new Error("Profile not found")

    const app = await prisma.jobApplication.findUnique({
      where: { id }
    })

    if (!app || app.profileId !== profile.id) {
      throw new Error("Unauthorized")
    }

    const updated = await prisma.jobApplication.update({
      where: { id },
      data: { status }
    })

    revalidatePath('/user/dashboard')

    return {
      id: updated.id,
      status: updated.status || "APPLIED"
    }
}
