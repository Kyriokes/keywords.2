'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getDesiredRolesForProfile, saveDesiredRoles, type DesiredRolesState } from "@/lib/positions/save"
import type { ActionResult } from "@/lib/validation"

async function findProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } })
  return profile?.id ?? null
}

/** Puestos deseados del usuario como roles del diccionario, más los roles que puede elegir. */
export async function getDesiredRoles(): Promise<DesiredRolesState> {
  const session = await auth()
  if (!session?.user?.id) return { selected: [], unrecognized: [], available: [] }

  const profileId = await findProfileId(session.user.id)
  if (!profileId) return { selected: [], unrecognized: [], available: [] }
  return getDesiredRolesForProfile(profileId)
}

export async function getPositions() {
  return (await getDesiredRoles()).selected
}

export async function updatePositions(
  newTitles: string[]
): Promise<ActionResult<{ roles: string[]; dropped: string[] }>> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profileId = await findProfileId(session.user.id)
  if (!profileId) throw new Error("Profile not found")

  const result = await saveDesiredRoles(profileId, newTitles)
  if (result.ok) {
    revalidatePath('/user/profile')
    revalidatePath('/user/add-job')
  }
  return result
}
