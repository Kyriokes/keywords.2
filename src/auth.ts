import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import authConfig from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
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
