import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import authConfig from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (!account || account.type !== "oauth") {
        return true
      }

      const rawEmail =
        typeof user.email === "string"
          ? user.email
          : typeof (profile as { email?: unknown })?.email === "string"
          ? ((profile as { email: string }).email ?? "")
          : ""
      const normalizedEmail = rawEmail.trim().toLowerCase()

      if (!normalizedEmail) {
        return "/login/oauth-error?reason=oauth_email_missing"
      }

      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        select: { id: true },
      })

      if (existingAccount) {
        return true
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      })

      if (!existingUser) {
        return true
      }

      try {
        await prisma.account.create({
          data: {
            userId: existingUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state:
              typeof account.session_state === "string"
                ? account.session_state
                : null,
          },
        })
      } catch {
        const linkedAfterError = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          select: { id: true },
        })

        if (!linkedAfterError) {
          return "/login/oauth-error?reason=oauth_linking_failed"
        }
      }

      user.id = existingUser.id
      user.email = normalizedEmail
      return true
    },
  },
  events: {
    createUser: async ({ user }) => {
      // Crear automáticamente un perfil cuando se crea un usuario
      if (user.id) {
        await prisma.profile.create({
          data: {
            userId: user.id,
          },
        })
      }
    },
  },
})
