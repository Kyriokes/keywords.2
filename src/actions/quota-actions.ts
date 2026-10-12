'use server'

import { auth } from "@/auth"
import { getQuotaStatus } from "@/lib/quota.service"

export async function getMyQuotaStatus() {
  const session = await auth()
  if (!session?.user?.id) return null
  return getQuotaStatus(session.user.id)
}
