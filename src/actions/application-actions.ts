'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { providerManager } from "@/lib/ia/providerManager"
import { isProviderId } from "@/lib/ia/providers/ids"
import { detectKeywords, keywordName, resolveTerms } from "@/lib/keywords/dictionary"
import { LIMITS, createApplicationSchema, firstIssueMessage, type ActionResult } from "@/lib/validation"

export interface CreateApplicationData {
  jobTitle: string
  jobDescription: string
  link?: string
  detectedWords: string[]
  positionTitle?: string
  provider?: string
}

const VALID_APPLICATION_STATUSES = ["APPLIED", "INTERVIEW", "SAVED", "REJECTED"] as const
type ValidApplicationStatus = typeof VALID_APPLICATION_STATUSES[number]

const applicationInclude = {
  keywords: {
    include: { keyword: true }
  },
  position: true
} satisfies Prisma.JobApplicationInclude

type ApplicationWithRelations = Prisma.JobApplicationGetPayload<{ include: typeof applicationInclude }>

// Formato que espera el store del cliente
function toStoreApplication(app: ApplicationWithRelations) {
  return {
    id: app.id,
    date: app.date.toISOString().split("T")[0],
    jobTitle: app.jobTitle,
    jobDescription: app.jobDescription,
    link: app.link || undefined,
    detectedWords: app.keywords.filter((k) => !k.keyword.isBlocked).map((k) => keywordName(k.keyword)),
    positionId: app.position?.title || app.originalPositionTitle || undefined,
    provider: app.provider || undefined,
    status: app.status || "APPLIED"
  }
}

export async function createApplication(
  data: CreateApplicationData
): Promise<ActionResult<ReturnType<typeof toStoreApplication>>> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const parsed = createApplicationSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  }
  const input = parsed.data
  const provider = isProviderId(input.provider) ? input.provider : undefined

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  const total = await prisma.jobApplication.count({
    where: { profileId: profile.id }
  })
  if (total >= LIMITS.applicationsPerProfile) {
    return {
      ok: false,
      code: "LIMIT_REACHED",
      message: `Alcanzaste el máximo de ${LIMITS.applicationsPerProfile} postulaciones.`
    }
  }

  // Check for duplicates by link
  if (input.link) {
    const exists = await prisma.jobApplication.findFirst({
      where: {
        profileId: profile.id,
        link: { equals: input.link, mode: 'insensitive' }
      },
      select: { id: true }
    })
    if (exists) {
      return { ok: false, code: "DUPLICATE_LINK", message: "Esta oferta ya existe (link duplicado)." }
    }
  }

  // Find related Position if exists
  let positionId: string | undefined
  if (input.positionTitle) {
    const position = await prisma.position.findFirst({
        where: {
            profileId: profile.id,
            title: input.positionTitle
        }
    })
    positionId = position?.id
  }

  // Find active CV
  const activeCv = await prisma.cV.findFirst({
      where: {
          profileId: profile.id,
          isPrimary: true
      }
  })

  // Keywords: los términos recibidos pasan por el diccionario y se suman los que
  // el diccionario detecta en la descripción (por ejemplo, en postulaciones importadas)
  const detected = await detectKeywords(input.jobDescription)
  const keywordIds = Array.from(
    new Set([...(await resolveTerms(input.detectedWords)), ...detected.map((k) => k.id)])
  ).slice(0, LIMITS.applicationKeywords)

  // Create Application
  const newApp = await prisma.jobApplication.create({
    data: {
      profileId: profile.id,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      link: input.link,
      provider,

      // Relations
      positionId: positionId,
      originalPositionTitle: input.positionTitle, // Snapshot History
      cvId: activeCv?.id,

      // Keywords Relation
      keywords: {
        create: keywordIds.map(keywordId => ({ keywordId }))
      }
    },
    include: applicationInclude
  })

  // Log acceptance if provider was used
  if (provider) {
    // Fire and forget
    providerManager.recordFeedback(profile.id, provider, 'accepted').catch(console.error)
  }

  revalidatePath('/user/dashboard')

  return { ok: true, data: toStoreApplication(newApp) }
}

export async function getApplications() {
    const session = await auth()
    if (!session?.user?.id) return []

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      include: {
        applications: {
            orderBy: { date: 'desc' },
            include: applicationInclude
        }
      }
    })

    if (!profile) return []

    return profile.applications.map(toStoreApplication)
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

    if (!VALID_APPLICATION_STATUSES.includes(status as ValidApplicationStatus)) {
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
