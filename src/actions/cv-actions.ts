'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { LIMITS, cvFileSchema, uploadCvSchema, firstIssueMessage, type ActionResult } from "@/lib/validation"
import { detectKeywords, keywordName, lookupTerms } from "@/lib/keywords/dictionary"

// Las keywords de un CV salen siempre del diccionario. Si el CV llega sin texto (por ejemplo,
// importado desde un Excel viejo) se usan las palabras recibidas que el diccionario reconozca.
async function cvKeywordIds(text: string, fallbackKeywords: string[]): Promise<string[]> {
  if (text.trim()) {
    return (await detectKeywords(text)).map((k) => k.id)
  }
  const known = await lookupTerms(fallbackKeywords)
  return Array.from(new Set(
    Array.from(known.values()).filter((k) => k.verified && !k.blocked).map((k) => k.id)
  ))
}

export async function uploadCV(data: { name: string; text: string; keywords: string[] }): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const parsed = uploadCvSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  }
  const input = parsed.data

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id }
  })

  if (!profile) throw new Error("Profile not found")

  // Check if it's the first CV to make it primary automatically
  const count = await prisma.cV.count({
    where: { profileId: profile.id }
  })

  if (count >= LIMITS.cvsPerProfile) {
    return {
      ok: false,
      code: "LIMIT_REACHED",
      message: `Alcanzaste el máximo de ${LIMITS.cvsPerProfile} CVs. Eliminá alguno para subir otro.`
    }
  }

  const keywordIds = (await cvKeywordIds(input.text, input.keywords)).slice(0, LIMITS.cvKeywords)

  await prisma.cV.create({
    data: {
      name: input.name,
      text: input.text,
      isPrimary: count === 0,
      profileId: profile.id,
      keywords: {
        create: keywordIds.map(keywordId => ({ keywordId }))
      }
    }
  })

  revalidatePath('/user/profile')
  return { ok: true, data: undefined }
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

  return profile.cvs.map((cv) => ({
    id: cv.id,
    name: cv.name,
    text: cv.text,
    uploadDate: cv.uploadDate.getTime(),
    isPrimary: cv.isPrimary,
    language: cv.language,
    fileUrl: cv.fileUrl,
    filePath: cv.filePath,
    keywords: cv.keywords.filter((k) => !k.keyword.isBlocked).map((k) => keywordName(k.keyword))
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

/** Guarda el archivo de un CV para postular: idioma, link público al PDF y ruta en la PC. */
export async function updateCvFile(
  cvId: string,
  data: { language: string | null; fileUrl: string; filePath: string }
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const parsed = cvFileSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!profile) throw new Error("Profile not found")

  const { count } = await prisma.cV.updateMany({ where: { id: cvId, profileId: profile.id }, data: parsed.data })
  if (count === 0) return { ok: false, code: "NOT_FOUND", message: "El CV ya no existe." }

  revalidatePath('/user/profile')
  return { ok: true, data: undefined }
}
