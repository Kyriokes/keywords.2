'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { positionTitlesSchema, firstIssueMessage, type ActionResult } from "@/lib/validation"

export async function getPositions() {
  const session = await auth()
  if (!session?.user?.id) return []

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: { positions: true }
  })

  if (!profile) return []

  return profile.positions.map((p) => p.title)
}

export async function updatePositions(newTitles: string[]): Promise<ActionResult<string[]>> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Trims, drops empty strings and duplicates, and enforces the max amount
  const parsed = positionTitlesSchema.safeParse(newTitles)
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  }
  const validTitles = parsed.data

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  // Transaction to sync
  await prisma.$transaction(async (tx) => {
    // 1. Get existing positions
    const existingPositions = await tx.position.findMany({
      where: { profileId: profile.id }
    })

    const existingTitles = existingPositions.map((p) => p.title)

    // 2. Identify deletions
    const toDelete = existingPositions.filter((p) => !validTitles.includes(p.title))
    if (toDelete.length > 0) {
        await tx.position.deleteMany({
            where: {
                profileId: profile.id,
                id: { in: toDelete.map((p) => p.id) }
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
  return { ok: true, data: validTitles }
}
