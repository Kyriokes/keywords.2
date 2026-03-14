'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getPositions() {
  const session = await auth()
  if (!session?.user?.id) return []

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: { positions: true }
  })

  if (!profile) return []

  return profile.positions.map((p: any) => p.title)
}

export async function updatePositions(newTitles: string[]) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  // Filter empty strings just in case
  const validTitles = newTitles.filter(t => t.trim() !== "")

  // Transaction to sync
  await prisma.$transaction(async (tx: any) => {
    // 1. Get existing positions
    const existingPositions = await tx.position.findMany({
      where: { profileId: profile.id }
    })
    
    const existingTitles = existingPositions.map((p: any) => p.title)
    
    // 2. Identify deletions
    const toDelete = existingPositions.filter((p: any) => !validTitles.includes(p.title))
    if (toDelete.length > 0) {
        await tx.position.deleteMany({
            where: { 
                profileId: profile.id,
                id: { in: toDelete.map((p: any) => p.id) }
            }
        })
    }

    // 3. Identify additions
    const toAdd = validTitles.filter(t => !existingTitles.includes(t))
    if (toAdd.length > 0) {
        await tx.position.createMany({
            data: toAdd.map(title => ({
                title,
                profileId: profile.id
            }))
        })
    }
  })
  
  revalidatePath('/user/profile')
  revalidatePath('/user/add-job')
  return { success: true }
}
