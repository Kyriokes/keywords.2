'use server'

import { z } from "zod"
import prisma from "@/lib/prisma"
import { isAdminSession } from "@/lib/auth-guards"
import { MAX_ALIAS_WORDS, aliasKey, tokenizeText } from "@/lib/keywords/core"
import { classifyTitle } from "@/lib/positions/classify"
import { getRoleCatalog, invalidateRoles } from "@/lib/positions/dictionary"
import { LIMITS, firstIssueMessage, type ActionResult } from "@/lib/validation"

const QUEUE_SIZE = 50

export interface PendingTitleGroup {
  /** El título sin seniority ni relleno: lo que tienen en común los títulos del grupo. */
  core: string
  /** Postulaciones de todos los usuarios con un título de este grupo. */
  count: number
  examples: string[]
}

export interface RolesQueue {
  pending: PendingTitleGroup[]
  pendingGroups: number
  pendingApplications: number
  totalApplications: number
  /** Postulaciones sin rol que el diccionario actual ya sabe clasificar. */
  reclassifiable: number
  roles: Array<{ id: string; name: string }>
}

async function requireAdmin() {
  if (!(await isAdminSession())) throw new Error("Forbidden")
}

/** Vuelve a clasificar las postulaciones sin rol con el diccionario actual. Devuelve cuántas quedaron con rol. */
async function reclassifyPending(): Promise<number> {
  invalidateRoles()
  const { dictionary } = await getRoleCatalog()

  const pending = await prisma.jobApplication.findMany({
    where: { canonicalPositionId: null },
    select: { id: true, jobTitle: true }
  })

  // Un UPDATE por combinación de rol y nivel, no uno por postulación
  const idsByTarget = new Map<string, { roleId: string; seniority: string | null; ids: string[] }>()
  for (const application of pending) {
    const { roleId, seniority } = classifyTitle(application.jobTitle, dictionary)
    if (!roleId) continue
    const key = `${roleId}|${seniority}`
    const target = idsByTarget.get(key) ?? { roleId, seniority, ids: [] }
    target.ids.push(application.id)
    idsByTarget.set(key, target)
  }

  let reclassified = 0
  for (const { roleId, seniority, ids } of idsByTarget.values()) {
    const { count } = await prisma.jobApplication.updateMany({
      where: { id: { in: ids }, canonicalPositionId: null },
      data: { canonicalPositionId: roleId, seniority }
    })
    reclassified += count
  }
  return reclassified
}

export async function getRolesQueue(): Promise<RolesQueue> {
  await requireAdmin()

  const [titles, totalApplications, { dictionary, names }] = await Promise.all([
    prisma.jobApplication.groupBy({
      by: ['jobTitle'],
      where: { canonicalPositionId: null },
      _count: { _all: true }
    }),
    prisma.jobApplication.count(),
    getRoleCatalog()
  ])

  let reclassifiable = 0
  const groups = new Map<string, PendingTitleGroup>()
  for (const { jobTitle, _count } of titles) {
    const { roleId, core } = classifyTitle(jobTitle, dictionary)
    if (roleId) {
      reclassifiable += _count._all
      continue
    }
    const key = aliasKey(core) || aliasKey(jobTitle)
    const group = groups.get(key) ?? { core: core || jobTitle, count: 0, examples: [] }
    group.count += _count._all
    if (group.examples.length < 3) group.examples.push(jobTitle)
    groups.set(key, group)
  }

  const pending = Array.from(groups.values()).sort((a, b) => b.count - a.count)

  return {
    pending: pending.slice(0, QUEUE_SIZE),
    pendingGroups: pending.length,
    pendingApplications: titles.reduce((sum, title) => sum + title._count._all, 0),
    totalApplications,
    reclassifiable,
    roles: Array.from(names, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"))
  }
}

const phrase = z
  .string()
  .trim()
  .min(1, "Escribí la frase que identifica al rol.")
  .max(LIMITS.title)
  .refine((value) => aliasKey(value).length > 0, "La frase no tiene letras ni números.")
  .refine(
    (value) => tokenizeText(value).length <= MAX_ALIAS_WORDS,
    `La frase puede tener hasta ${MAX_ALIAS_WORDS} palabras: dejá solo las que identifican al rol.`
  )

const assignSchema = z.object({ phrase, roleId: z.string().min(1) })

/** Declara que los títulos que contienen una frase corresponden a un rol, y reclasifica los pendientes. */
export async function assignTitlePhrase(
  input: z.input<typeof assignSchema>
): Promise<ActionResult<{ reclassified: number }>> {
  await requireAdmin()

  const parsed = assignSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  }
  const aliasText = aliasKey(parsed.data.phrase)

  const role = await prisma.canonicalPosition.findUnique({
    where: { id: parsed.data.roleId },
    select: { id: true }
  })
  if (!role) {
    return { ok: false, code: "NOT_FOUND", message: "Ese rol ya no existe." }
  }

  const taken = await prisma.positionAlias.findUnique({
    where: { aliasText },
    select: { canonicalPositionId: true, canonicalPosition: { select: { name: true } } }
  })
  if (taken && taken.canonicalPositionId !== role.id) {
    return {
      ok: false,
      code: "ALIAS_TAKEN",
      message: `Esa frase ya identifica a "${taken.canonicalPosition.name}".`
    }
  }
  if (!taken) {
    await prisma.positionAlias.create({ data: { aliasText, canonicalPositionId: role.id } })
  }

  return { ok: true, data: { reclassified: await reclassifyPending() } }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "El rol necesita un nombre.").max(LIMITS.keywordLength),
  phrase
})

/** Crea un rol nuevo, reconocible por su nombre y por la frase indicada. */
export async function createRole(
  input: z.input<typeof createSchema>
): Promise<ActionResult<{ reclassified: number }>> {
  await requireAdmin()

  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) }
  }
  const { name } = parsed.data
  const aliasTexts = Array.from(new Set([aliasKey(name), aliasKey(parsed.data.phrase)].filter(Boolean)))

  const [existingRole, takenAlias, sector] = await Promise.all([
    prisma.canonicalPosition.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true }
    }),
    prisma.positionAlias.findFirst({
      where: { aliasText: { in: aliasTexts } },
      select: { canonicalPosition: { select: { name: true } } }
    }),
    prisma.sector.findFirst({ select: { id: true } })
  ])
  if (existingRole) {
    return { ok: false, code: "DUPLICATE", message: "Ya existe un rol con ese nombre. Asigná la frase a ese rol." }
  }
  if (takenAlias) {
    return {
      ok: false,
      code: "ALIAS_TAKEN",
      message: `Ese nombre o esa frase ya identifican a "${takenAlias.canonicalPosition.name}".`
    }
  }

  await prisma.canonicalPosition.create({
    data: {
      name,
      sectorId: sector?.id,
      aliases: { create: aliasTexts.map((aliasText) => ({ aliasText })) }
    }
  })

  return { ok: true, data: { reclassified: await reclassifyPending() } }
}

/** Clasifica las postulaciones sin rol con el diccionario actual (por ejemplo, después de ampliar la semilla). */
export async function reclassifyPendingTitles(): Promise<ActionResult<{ reclassified: number }>> {
  await requireAdmin()
  return { ok: true, data: { reclassified: await reclassifyPending() } }
}
