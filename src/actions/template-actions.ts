'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  LIMITS,
  answerTemplateSchema,
  coverLetterTemplateSchema,
  firstIssueMessage,
  mediaAssetSchema,
  type ActionResult
} from "@/lib/validation"

export interface AnswerTemplateItem {
  id: string
  question: string
  answer: string
  tags: string[]
  language: string | null
  /** VERBATIM se copia tal cual; ADAPT Claude la reescribe para cada oferta. */
  mode: string
  /** Cuántas respuestas enviadas salieron de esta plantilla. */
  usedCount: number
}

export interface CoverLetterTemplateItem {
  id: string
  name: string
  text: string
}

export interface MediaAssetItem {
  id: string
  kind: string
  name: string
  url: string
}

export interface TemplatesData {
  answers: AnswerTemplateItem[]
  coverLetters: CoverLetterTemplateItem[]
  media: MediaAssetItem[]
}

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

const done = () => revalidatePath("/user/templates")

/** Cuántas veces se usó cada plantilla en una postulación enviada. */
async function countUses(templateIds: string[]): Promise<Map<string, number>> {
  if (templateIds.length === 0) return new Map()
  const uses = await prisma.applicationAnswer.groupBy({
    by: ["templateId"],
    where: { templateId: { in: templateIds } },
    _count: { _all: true }
  })
  return new Map(uses.flatMap((use) => (use.templateId ? [[use.templateId, use._count._all] as const] : [])))
}

export async function getTemplates(): Promise<TemplatesData> {
  const profileId = await requireProfileId()
  const [answers, coverLetters, media] = await Promise.all([
    prisma.answerTemplate.findMany({
      where: { profileId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, question: true, answer: true, tags: true, language: true, mode: true }
    }),
    // Una carta sin postulación es una plantilla
    prisma.coverLetter.findMany({
      where: { profileId, applicationId: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, text: true }
    }),
    prisma.mediaAsset.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, name: true, url: true }
    })
  ])
  const uses = await countUses(answers.map((answer) => answer.id))
  return {
    answers: answers.map((answer) => ({ ...answer, usedCount: uses.get(answer.id) ?? 0 })),
    coverLetters: coverLetters.map((letter) => ({ ...letter, name: letter.name ?? "Carta" })),
    media
  }
}

/** Crea la plantilla, o la actualiza si viene `id`. */
export async function saveAnswerTemplate(
  data: { id?: string; question: string; answer: string; tags?: string[]; language?: string; mode?: string }
): Promise<ActionResult<AnswerTemplateItem>> {
  const profileId = await requireProfileId()
  const parsed = answerTemplateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  const input = parsed.data
  const select = { id: true, question: true, answer: true, tags: true, language: true, mode: true }

  if (data.id) {
    const updated = await prisma.answerTemplate.updateMany({
      where: { id: data.id, profileId },
      data: { question: input.question, answer: input.answer, tags: input.tags, language: input.language ?? null, mode: input.mode }
    })
    if (updated.count === 0) return { ok: false, code: "NOT_FOUND", message: "La plantilla ya no existe." }
    done()
    const [saved, uses] = await Promise.all([
      prisma.answerTemplate.findUniqueOrThrow({ where: { id: data.id }, select }),
      countUses([data.id])
    ])
    return { ok: true, data: { ...saved, usedCount: uses.get(data.id) ?? 0 } }
  }

  const total = await prisma.answerTemplate.count({ where: { profileId } })
  if (total >= LIMITS.answerTemplates) {
    return { ok: false, code: "LIMIT_REACHED", message: `Podés tener hasta ${LIMITS.answerTemplates} respuestas tipo.` }
  }
  const created = await prisma.answerTemplate.create({
    data: { profileId, question: input.question, answer: input.answer, tags: input.tags, language: input.language, mode: input.mode },
    select
  })
  done()
  return { ok: true, data: { ...created, usedCount: 0 } }
}

export async function deleteAnswerTemplate(id: string): Promise<void> {
  const profileId = await requireProfileId()
  await prisma.answerTemplate.deleteMany({ where: { id, profileId } })
  done()
}

export async function saveCoverLetterTemplate(
  data: { id?: string; name: string; text: string }
): Promise<ActionResult<CoverLetterTemplateItem>> {
  const profileId = await requireProfileId()
  const parsed = coverLetterTemplateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  const input = parsed.data

  if (data.id) {
    // applicationId null: desde acá no se editan las cartas que ya se enviaron
    const updated = await prisma.coverLetter.updateMany({
      where: { id: data.id, profileId, applicationId: null },
      data: { name: input.name, text: input.text }
    })
    if (updated.count === 0) return { ok: false, code: "NOT_FOUND", message: "La carta ya no existe." }
    done()
    return { ok: true, data: { id: data.id, ...input } }
  }

  const total = await prisma.coverLetter.count({ where: { profileId, applicationId: null } })
  if (total >= LIMITS.coverLetterTemplates) {
    return { ok: false, code: "LIMIT_REACHED", message: `Podés tener hasta ${LIMITS.coverLetterTemplates} cartas modelo.` }
  }
  const created = await prisma.coverLetter.create({
    data: { profileId, name: input.name, text: input.text },
    select: { id: true }
  })
  done()
  return { ok: true, data: { id: created.id, ...input } }
}

export async function deleteCoverLetterTemplate(id: string): Promise<void> {
  const profileId = await requireProfileId()
  await prisma.coverLetter.deleteMany({ where: { id, profileId, applicationId: null } })
  done()
}

/** Guarda el link a un video de presentación (YouTube oculto, Drive, Loom...). */
export async function addVideoLink(data: { name: string; url: string }): Promise<ActionResult<MediaAssetItem>> {
  const profileId = await requireProfileId()
  const parsed = mediaAssetSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }

  const total = await prisma.mediaAsset.count({ where: { profileId } })
  if (total >= LIMITS.mediaAssets) {
    return { ok: false, code: "LIMIT_REACHED", message: `Podés guardar hasta ${LIMITS.mediaAssets} videos.` }
  }
  const created = await prisma.mediaAsset.create({
    data: { profileId, kind: "VIDEO", name: parsed.data.name, url: parsed.data.url },
    select: { id: true, kind: true, name: true, url: true }
  })
  done()
  return { ok: true, data: created }
}

export async function deleteMediaAsset(id: string): Promise<void> {
  const profileId = await requireProfileId()
  await prisma.mediaAsset.deleteMany({ where: { id, profileId } })
  done()
}
