import { UserRole } from "@prisma/client"
import NextAuth, { type DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's role. */
      role: UserRole
    } & DefaultSession["user"]
  }

  interface User {
    role?: UserRole
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `auth`, when using JWT sessions */
  interface JWT {
    /** The user's role. */
    role: UserRole
  }
}
