'use server'

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { generateAgentToken, hashAgentToken, tokenDisplayPrefix } from "@/lib/agent/tokens"
import { LIMITS, type ActionResult } from "@/lib/validation"

export interface AgentTokenSummary {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return session.user.id
}

/** Tokens activos del usuario, sin el valor (solo se muestra al crearlo). */
export async function listAgentTokens(): Promise<AgentTokenSummary[]> {
  const userId = await requireUserId()
  const tokens = await prisma.agentToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true }
  })
  return tokens.map((token) => ({
    ...token,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null
  }))
}

/** Crea un token y lo devuelve una única vez; en la base queda solo su hash. */
export async function createAgentToken(name: string): Promise<ActionResult<{ token: string; summary: AgentTokenSummary }>> {
  const userId = await requireUserId()

  const label = name.trim().slice(0, LIMITS.agentTokenName) || "Claude Code"
  const active = await prisma.agentToken.count({ where: { userId, revokedAt: null } })
  if (active >= LIMITS.agentTokens) {
    return {
      ok: false,
      code: "LIMIT_REACHED",
      message: `Podés tener hasta ${LIMITS.agentTokens} tokens activos. Revocá uno que no uses.`
    }
  }

  const token = generateAgentToken()
  const created = await prisma.agentToken.create({
    data: { userId, name: label, tokenHash: hashAgentToken(token), prefix: tokenDisplayPrefix(token) },
    select: { id: true, name: true, prefix: true, createdAt: true }
  })

  revalidatePath("/user/connect")
  return {
    ok: true,
    data: {
      token,
      summary: { ...created, createdAt: created.createdAt.toISOString(), lastUsedAt: null }
    }
  }
}

export async function revokeAgentToken(id: string): Promise<void> {
  const userId = await requireUserId()
  // updateMany con userId: un id ajeno no revoca nada
  await prisma.agentToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() }
  })
  revalidatePath("/user/connect")
}
