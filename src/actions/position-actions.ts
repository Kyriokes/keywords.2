'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { toDesiredRoles } from "@/lib/positions/desired"
import { getRoleCatalog } from "@/lib/positions/dictionary"
import { OTHER_ROLE } from "@/lib/positions/rules"
import { positionTitlesSchema, firstIssueMessage, type ActionResult } from "@/lib/validation"

export interface DesiredRolesState {
  /** Roles deseados del usuario. */
  selected: string[]
  /** Puestos guardados antes del diccionario que no corresponden a ningún rol. */
  unrecognized: string[]
  /** Todos los roles que se pueden elegir. */
  available: string[]
}

/**
 * Puestos deseados del usuario como roles del diccionario. Los que se guardaron como texto
 * libre se convierten al leerlos; en la base quedan normalizados la próxima vez que se guarde.
 */
export async function getDesiredRoles(): Promise<DesiredRolesState> {
  const session = await auth()
  if (!session?.user?.id) return { selected: [], unrecognized: [], available: [] }

  const [profile, { dictionary, names }] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      include: { positions: { orderBy: { createdAt: 'asc' } } }
    }),
    getRoleCatalog()
  ])

  const { roles, unrecognized } = toDesiredRoles(profile?.positions.map((p) => p.title) ?? [], dictionary, names)

  return {
    selected: roles,
    unrecognized,
    available: Array.from(names.values()).filter((name) => name !== OTHER_ROLE).sort((a, b) => a.localeCompare(b, "es"))
  }
}

export async function getPositions() {
  return (await getDesiredRoles()).selected
}

export async function updatePositions(
  newTitles: string[]
): Promise<ActionResult<{ roles: string[]; dropped: string[] }>> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Trims, drops empty strings and duplicates
  const parsed = positionTitlesSchema.safeParse(newTitles)
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  }

  // Only dictionary roles are stored; anything else (e.g. free text from an old backup) is dropped
  const { dictionary, names } = await getRoleCatalog()
  const { roles: validTitles, unrecognized: dropped } = toDesiredRoles(parsed.data, dictionary, names)

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
  return { ok: true, data: { roles: validTitles, dropped } }
}
