'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { DEFAULT_PERIOD, STATS_PERIODS, type StatsPeriod } from "@/lib/stats/searchStats"
import { loadSearchStats, type SearchStats } from "@/lib/stats/searchStatsQuery"

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

/** Estadísticas de la búsqueda del usuario en los últimos 7, 30 o 90 días. */
export async function getSearchStats(days: StatsPeriod): Promise<SearchStats> {
  const profileId = await requireProfileId()
  // Una server action se puede llamar con cualquier valor: lo que no es un período conocido vuelve al de por defecto
  const period = (STATS_PERIODS as readonly number[]).includes(days) ? days : DEFAULT_PERIOD
  return loadSearchStats(profileId, period)
}
