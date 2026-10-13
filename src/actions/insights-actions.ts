'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { aliasKey, buildTextIndex, textMentions } from "@/lib/keywords/core"
import { toKeywordCategory } from "@/lib/keywords/categories"
import { keywordName } from "@/lib/keywords/dictionary"
import type { InsightKeyword } from "@/lib/stats/keywordAnalysis"

export interface KeywordInsights {
  /** CV contra el que se calculó `inCv`; null si el perfil no tiene ninguno. */
  cvId: string | null
  keywords: InsightKeyword[]
  /** Ids de keyword por postulación. */
  byApplication: Record<string, string[]>
}

/**
 * Keywords que piden las postulaciones del usuario, cruzadas con un CV (el indicado o el activo).
 * Los totales se calculan en el cliente, que es quien conoce los filtros.
 */
export async function getKeywordInsights(cvId?: string): Promise<KeywordInsights | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  })
  if (!profile) return null

  const [links, cv] = await Promise.all([
    prisma.jobApplicationKeyword.findMany({
      where: { jobApplication: { profileId: profile.id }, keyword: { isBlocked: false } },
      select: { jobApplicationId: true, keywordId: true }
    }),
    prisma.cV.findFirst({
      // El id solo sirve si el CV es de este perfil
      where: cvId ? { id: cvId, profileId: profile.id } : { profileId: profile.id },
      orderBy: [{ isPrimary: 'desc' }, { uploadDate: 'desc' }],
      select: { id: true, text: true, keywords: { select: { keywordId: true } } }
    })
  ])

  const byApplication: Record<string, string[]> = {}
  for (const link of links) {
    (byApplication[link.jobApplicationId] ??= []).push(link.keywordId)
  }

  const requested = await prisma.keyword.findMany({
    where: { id: { in: Array.from(new Set(links.map((link) => link.keywordId))) } },
    select: {
      id: true,
      displayName: true,
      canonicalText: true,
      category: true,
      isApproved: true,
      aliases: { select: { aliasText: true, exactText: true } }
    }
  })

  // "Está en el CV" se decide contra el texto: por cualquiera de sus alias, o por su propio nombre
  // como frase contigua. Los vínculos guardados cubren los CVs que no tienen texto.
  const cvText = cv ? buildTextIndex(cv.text) : null
  const linkedToCv = new Set(cv?.keywords.map((link) => link.keywordId))

  const keywords: InsightKeyword[] = requested.map((keyword) => {
    const name = keywordName(keyword)
    const inCv = linkedToCv.has(keyword.id) || (cvText !== null && (
      keyword.aliases.some((alias) => textMentions(cvText, alias)) ||
      // Una keyword vieja puede no tener alias todavía: se prueba con su nombre
      (keyword.aliases.length === 0 && textMentions(cvText, { aliasText: aliasKey(name) }))
    ))

    return {
      id: keyword.id,
      name,
      category: toKeywordCategory(keyword.category),
      verified: keyword.isApproved,
      inCv
    }
  })

  return { cvId: cv?.id ?? null, keywords, byApplication }
}
