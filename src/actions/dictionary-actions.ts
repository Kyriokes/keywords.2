'use server'

import fuzzysort from "fuzzysort"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { isAdminSession } from "@/lib/auth-guards"
import { aliasKey } from "@/lib/keywords/core"
import { KEYWORD_CATEGORIES, toKeywordCategory, type KeywordCategory } from "@/lib/keywords/categories"
import { getDictionary, invalidateDictionary, keywordName } from "@/lib/keywords/dictionary"
import { mergeKeywordInto } from "@/lib/keywords/merge"
import { suggestMergeTargets } from "@/lib/keywords/suggest"
import { LIMITS, firstIssueMessage, type ActionResult } from "@/lib/validation"

const QUEUE_SIZE = 50

export interface DictionaryTarget {
  id: string
  name: string
}

export interface PendingKeyword {
  id: string
  name: string
  /** Postulaciones que la piden, sumando las de todos los usuarios. */
  applications: number
  /** Entrada del diccionario que ya tiene este término como alias; solo queda fusionarlos. */
  sameAs: DictionaryTarget | null
  /** Otras entradas del diccionario a las que podría corresponder. */
  suggestions: DictionaryTarget[]
}

export interface DictionaryQueue {
  pending: PendingKeyword[]
  pendingTotal: number
  /** Pendientes que ya son alias de una entrada: se pueden fusionar todos juntos. */
  knownAliases: number
  dictionarySize: number
  /** Porcentaje de menciones en postulaciones que ya usan un término verificado; null si no hay menciones. */
  verifiedShare: number | null
}

async function requireAdmin() {
  if (!(await isAdminSession())) throw new Error("Forbidden")
}

// Solo entran a la cola las que piden postulaciones: es lo que afecta las métricas
const pendingWhere = { isApproved: false, isBlocked: false, jobApplications: { some: {} } }

export async function getDictionaryQueue(): Promise<DictionaryQueue> {
  await requireAdmin()

  const [allPending, mentions, verifiedMentions, dictionary] = await Promise.all([
    prisma.keyword.findMany({
      where: pendingWhere,
      select: {
        id: true,
        displayName: true,
        canonicalText: true,
        _count: { select: { jobApplications: true } }
      },
      orderBy: { jobApplications: { _count: 'desc' } }
    }),
    prisma.jobApplicationKeyword.count({ where: { keyword: { isBlocked: false } } }),
    prisma.jobApplicationKeyword.count({ where: { keyword: { isApproved: true, isBlocked: false } } }),
    getDictionary()
  ])

  const knownAliases = allPending.filter((keyword) => dictionary.index.has(aliasKey(keywordName(keyword)))).length

  return {
    pending: allPending.slice(0, QUEUE_SIZE).map((keyword) => {
      const name = keywordName(keyword)
      const { sameAs, similar } = suggestMergeTargets(name, dictionary)

      return {
        id: keyword.id,
        name,
        applications: keyword._count.jobApplications,
        sameAs,
        suggestions: similar
      }
    }),
    pendingTotal: allPending.length,
    knownAliases,
    dictionarySize: dictionary.keywords.size,
    verifiedShare: mentions > 0 ? Math.round((verifiedMentions / mentions) * 100) : null
  }
}

export async function searchDictionary(query: string): Promise<DictionaryTarget[]> {
  await requireAdmin()

  if (typeof query !== "string" || !query.trim()) return []

  const { keywords } = await getDictionary()
  return fuzzysort
    .go(query.trim().slice(0, LIMITS.keywordLength), Array.from(keywords.values()), { key: "name", limit: 8 })
    .map((result) => ({ id: result.obj.id, name: result.obj.name }))
}

const approveSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().min(1, "El nombre no puede estar vacío.").max(LIMITS.keywordLength),
  category: z.enum(KEYWORD_CATEGORIES)
})

/** Pasa un término sin verificar al diccionario, con su nombre visible y su categoría. */
export async function approveKeyword(input: z.input<typeof approveSchema>): Promise<ActionResult> {
  await requireAdmin()

  const parsed = approveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  }
  const { id, displayName, category } = parsed.data

  const keyword = await prisma.keyword.findUnique({
    where: { id },
    select: { displayName: true, canonicalText: true }
  })
  if (!keyword) {
    return { ok: false, code: "NOT_FOUND", message: "Ese término ya no existe." }
  }

  const keys = Array.from(new Set([aliasKey(displayName), aliasKey(keywordName(keyword))].filter(Boolean)))
  const taken = await prisma.keywordAlias.findFirst({
    where: { aliasText: { in: keys }, NOT: { keywordId: id } },
    select: { keyword: { select: { displayName: true, canonicalText: true } } }
  })
  if (taken) {
    return {
      ok: false,
      code: "ALIAS_TAKEN",
      message: `Ese nombre ya corresponde a "${keywordName(taken.keyword)}". Usá Fusionar.`
    }
  }

  await prisma.$transaction([
    prisma.keyword.update({
      where: { id },
      data: { displayName, category, isApproved: true, source: "admin" }
    }),
    prisma.keywordAlias.createMany({
      data: keys.map((aliasText) => ({ aliasText, keywordId: id })),
      skipDuplicates: true
    })
  ])

  invalidateDictionary()
  return { ok: true, data: undefined }
}

const mergeSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1)
})

/** Declara que un término sin verificar es una variante de una entrada del diccionario. */
export async function mergeKeyword(input: z.input<typeof mergeSchema>): Promise<ActionResult> {
  await requireAdmin()

  const parsed = mergeSchema.safeParse(input)
  if (!parsed.success || parsed.data.sourceId === parsed.data.targetId) {
    return { ok: false, code: "INVALID_INPUT", message: "Elegí una entrada distinta para fusionar." }
  }
  const { sourceId, targetId } = parsed.data

  const [source, target] = await Promise.all([
    prisma.keyword.findUnique({ where: { id: sourceId }, select: { isApproved: true } }),
    prisma.keyword.findUnique({ where: { id: targetId }, select: { isApproved: true, isBlocked: true } })
  ])
  if (!source || !target) {
    return { ok: false, code: "NOT_FOUND", message: "Alguno de los términos ya no existe." }
  }
  // Solo se fusiona hacia el diccionario, y nunca se borra una entrada ya verificada
  if (source.isApproved || !target.isApproved || target.isBlocked) {
    return { ok: false, code: "INVALID_INPUT", message: "Solo se puede fusionar un término sin verificar con una entrada del diccionario." }
  }

  await prisma.$transaction((tx) => mergeKeywordInto(tx, sourceId, targetId))

  invalidateDictionary()
  return { ok: true, data: undefined }
}

/** Marca un término como ruido: deja de mostrarse y de contar en las métricas. */
export async function blockKeyword(id: string): Promise<ActionResult> {
  await requireAdmin()

  if (typeof id !== "string" || !id) {
    return { ok: false, code: "INVALID_INPUT", message: "Término inválido." }
  }

  const { count } = await prisma.keyword.updateMany({
    where: { id, isApproved: false },
    data: { isBlocked: true }
  })
  if (count === 0) {
    return { ok: false, code: "NOT_FOUND", message: "Ese término ya no está pendiente." }
  }

  invalidateDictionary()
  return { ok: true, data: undefined }
}

/**
 * Fusiona de una vez todos los términos sin verificar que el diccionario ya tiene como alias
 * de una entrada (por ejemplo "ai" → Inteligencia Artificial). Es lo mismo que resolverlos
 * uno por uno desde la cola.
 */
export async function mergeKnownAliases(): Promise<ActionResult<{ merged: number }>> {
  await requireAdmin()

  invalidateDictionary()
  const [pending, dictionary] = await Promise.all([
    prisma.keyword.findMany({
      where: { isApproved: false, isBlocked: false },
      select: { id: true, displayName: true, canonicalText: true }
    }),
    getDictionary()
  ])

  let merged = 0
  for (const keyword of pending) {
    const owner = dictionary.index.get(aliasKey(keywordName(keyword)))
    if (!owner || owner.keywordId === keyword.id) continue

    await prisma.$transaction((tx) => mergeKeywordInto(tx, keyword.id, owner.keywordId))
    merged++
  }

  invalidateDictionary()
  return { ok: true, data: { merged } }
}

export interface DictionaryEntry {
  id: string
  name: string
  category: KeywordCategory
  blocked: boolean
  /** Postulaciones que la piden, sumando las de todos los usuarios. */
  applications: number
  aliases: number
}

/** Busca entradas del diccionario, aprobadas o bloqueadas, por nombre o por alias. */
export async function searchDictionaryEntries(query: string): Promise<DictionaryEntry[]> {
  await requireAdmin()

  const text = typeof query === "string" ? query.trim().slice(0, LIMITS.keywordLength) : ""
  if (text.length < 2) return []

  const key = aliasKey(text)
  const entries = await prisma.keyword.findMany({
    where: {
      AND: [
        { OR: [{ isApproved: true }, { isBlocked: true }] },
        {
          OR: [
            { displayName: { contains: text, mode: 'insensitive' } },
            { canonicalText: { contains: text, mode: 'insensitive' } },
            ...(key ? [{ aliases: { some: { aliasText: { contains: key } } } }] : [])
          ]
        }
      ]
    },
    select: {
      id: true,
      displayName: true,
      canonicalText: true,
      category: true,
      isBlocked: true,
      _count: { select: { jobApplications: true, aliases: true } }
    },
    orderBy: { jobApplications: { _count: 'desc' } },
    take: 20
  })

  return entries.map((entry) => ({
    id: entry.id,
    name: keywordName(entry),
    category: toKeywordCategory(entry.category),
    blocked: entry.isBlocked,
    applications: entry._count.jobApplications,
    aliases: entry._count.aliases
  }))
}

/** Cambia el nombre visible o la categoría de una entrada ya aprobada. */
export async function updateKeyword(input: z.input<typeof approveSchema>): Promise<ActionResult> {
  await requireAdmin()

  const parsed = approveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  }
  const { id, displayName, category } = parsed.data

  const keyword = await prisma.keyword.findUnique({ where: { id }, select: { isApproved: true } })
  if (!keyword?.isApproved) {
    return { ok: false, code: "NOT_FOUND", message: "Esa entrada ya no está en el diccionario." }
  }

  // El nombre nuevo también tiene que identificar a esta entrada, y a ninguna otra
  const aliasText = aliasKey(displayName)
  const taken = await prisma.keywordAlias.findUnique({
    where: { aliasText },
    select: { keywordId: true, keyword: { select: { displayName: true, canonicalText: true } } }
  })
  if (taken && taken.keywordId !== id) {
    return {
      ok: false,
      code: "ALIAS_TAKEN",
      message: `Ese nombre ya corresponde a "${keywordName(taken.keyword)}".`
    }
  }

  await prisma.$transaction([
    prisma.keyword.update({ where: { id }, data: { displayName, category } }),
    prisma.keywordAlias.createMany({ data: [{ aliasText, keywordId: id }], skipDuplicates: true })
  ])

  invalidateDictionary()
  return { ok: true, data: undefined }
}

/** Saca el bloqueo de un término: vuelve a contar en las métricas y a la cola de revisión. */
export async function unblockKeyword(id: string): Promise<ActionResult> {
  await requireAdmin()

  if (typeof id !== "string" || !id) {
    return { ok: false, code: "INVALID_INPUT", message: "Término inválido." }
  }

  const { count } = await prisma.keyword.updateMany({
    where: { id, isBlocked: true },
    data: { isBlocked: false }
  })
  if (count === 0) {
    return { ok: false, code: "NOT_FOUND", message: "Ese término no está bloqueado." }
  }

  invalidateDictionary()
  return { ok: true, data: undefined }
}
