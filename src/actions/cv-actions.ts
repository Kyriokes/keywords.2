'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function uploadCV(data: { name: string; text: string; keywords: string[] }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  // Check if it's the first CV to make it primary automatically
  const count = await prisma.cV.count({
    where: { profileId: profile.id }
  })

  const newCV = await prisma.cV.create({
    data: {
      name: data.name,
      text: data.text,
      isPrimary: count === 0,
      profileId: profile.id,
      keywords: {
        create: data.keywords.map(k => ({
          keyword: {
            connectOrCreate: {
              where: { canonicalText: k.toLowerCase() },
              create: { canonicalText: k.toLowerCase() }
            }
          }
        }))
      }
    }
  })

  revalidatePath('/user/profile')
  return newCV
}

export async function getCVs() {
  const session = await auth()
  if (!session?.user?.id) return []

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: { 
      cvs: {
        orderBy: { uploadDate: 'desc' },
        include: {
            keywords: {
                include: {
                    keyword: true
                }
            }
        }
      } 
    }
  })

  if (!profile) return []

  return profile.cvs.map(cv => ({
    id: cv.id,
    name: cv.name,
    text: cv.text,
    uploadDate: cv.uploadDate.getTime(),
    isPrimary: cv.isPrimary,
    keywords: cv.keywords.map((k: { keyword: { canonicalText: string } }) => k.keyword.canonicalText)
  }))
}

export async function deleteCV(cvId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  // Verify ownership
  const cv = await prisma.cV.findUnique({
    where: { id: cvId }
  })

  if (!cv || cv.profileId !== profile.id) {
    throw new Error("CV not found or unauthorized")
  }

  await prisma.cV.delete({
    where: { id: cvId }
  })

  // If deleted CV was primary, try to assign a new one
  if (cv.isPrimary) {
    const nextCv = await prisma.cV.findFirst({
        where: { profileId: profile.id },
        orderBy: { uploadDate: 'desc' }
    })
    
    if (nextCv) {
        await prisma.cV.update({
            where: { id: nextCv.id },
            data: { isPrimary: true }
        })
    }
  }

  revalidatePath('/user/profile')
  return { success: true }
}

export async function setPrimaryCV(cvId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  await prisma.$transaction([
    // Unset current primary
    prisma.cV.updateMany({
      where: { profileId: profile.id, isPrimary: true },
      data: { isPrimary: false }
    }),
    // Set new primary
    prisma.cV.update({
      where: { id: cvId, profileId: profile.id },
      data: { isPrimary: true }
    })
  ])

  revalidatePath('/user/profile')
  return { success: true }
}
