'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface CreateApplicationData {
  jobTitle: string
  jobDescription: string
  link?: string
  detectedWords: string[]
  positionTitle?: string
  provider?: string
}

export async function createApplication(data: CreateApplicationData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  // Check for duplicates by link
  if (data.link) {
    const exists = await prisma.jobApplication.findFirst({
      where: {
        profileId: profile.id,
        link: data.link
      }
    })
    if (exists) throw new Error("Duplicate link")
  }

  // Find related Position if exists
  let positionId: string | undefined
  if (data.positionTitle) {
    const position = await prisma.position.findFirst({
        where: {
            profileId: profile.id,
            title: data.positionTitle
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

  // Create Application
  const newApp = await prisma.jobApplication.create({
    data: {
      profileId: profile.id,
      jobTitle: data.jobTitle,
      jobDescription: data.jobDescription,
      link: data.link,
      provider: data.provider,
      
      // Relations
      positionId: positionId,
      originalPositionTitle: data.positionTitle, // Snapshot History
      cvId: activeCv?.id,
      
      // Keywords Relation
      keywords: {
        create: data.detectedWords.map(k => ({
          keyword: {
            connectOrCreate: {
              where: { canonicalText: k.toLowerCase() },
              create: { canonicalText: k.toLowerCase() }
            }
          }
        }))
      }
    },
    include: {
        keywords: {
            include: { keyword: true }
        },
        position: true
    }
  })

  revalidatePath('/user/dashboard')
  
  // Return formatted for store
  return {
      id: newApp.id,
      date: newApp.date.toISOString().split("T")[0],
      jobTitle: newApp.jobTitle,
      jobDescription: newApp.jobDescription,
      link: newApp.link || undefined,
      detectedWords: newApp.keywords.map(k => k.keyword.canonicalText),
      positionId: newApp.position?.title || newApp.originalPositionTitle || undefined,
      provider: newApp.provider || undefined
  }
}

export async function getApplications() {
    const session = await auth()
    if (!session?.user?.id) return []
  
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      include: {
        applications: {
            orderBy: { date: 'desc' },
            include: {
                keywords: { include: { keyword: true } },
                position: true
            }
        }
      }
    })
  
    if (!profile) return []
  
    return profile.applications.map(app => ({
        id: app.id,
        date: app.date.toISOString().split("T")[0],
        jobTitle: app.jobTitle,
        jobDescription: app.jobDescription,
        link: app.link || undefined,
        detectedWords: app.keywords.map(k => k.keyword.canonicalText),
        positionId: app.position?.title || app.originalPositionTitle || undefined,
        provider: app.provider || undefined
    }))
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
