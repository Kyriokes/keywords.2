'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { deletePreference, savePreference, type PreferenceRow } from "@/lib/preferences/preferences"
import { firstIssueMessage, preferenceSchema, type ActionResult } from "@/lib/validation"

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

/** Guarda una preferencia cargada a mano desde el panel de la cola. */
export async function addPreference(kind: string, value: string): Promise<ActionResult<PreferenceRow>> {
  const profileId = await requireProfileId()
  const parsed = preferenceSchema.safeParse({ kind, value })
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }

  const result = await savePreference(profileId, { ...parsed.data, origin: "USER" })
  if (!result.ok) return result
  if (!result.data.created) return { ok: false, code: "DUPLICATE", message: "Esa preferencia ya estaba guardada." }

  revalidatePath("/user/queue")
  return {
    ok: true,
    data: { id: result.data.id, kind: parsed.data.kind, value: result.data.value, origin: "USER", note: null, createdAt: new Date().toISOString() }
  }
}

/** Borra una preferencia, por ejemplo algo que KeyWords aprendió y el usuario no quería. */
export async function removePreference(id: string): Promise<ActionResult> {
  const profileId = await requireProfileId()
  const deleted = await deletePreference(profileId, id)
  if (!deleted) return { ok: false, code: "NOT_FOUND", message: "Esa preferencia ya no existe." }
  revalidatePath("/user/queue")
  return { ok: true, data: undefined }
}
