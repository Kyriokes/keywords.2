import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    LinkedIn({
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // El rol solo se toma del usuario de la base al iniciar sesión. Nunca del `session`
    // que llega con trigger "update": ese objeto lo arma el cliente.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Forzamos un valor por defecto si role es undefined, pero preferimos el de la DB
        token.role = user.role || "HUNTER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role =
          (token.role as "ADMIN" | "HUNTER" | "RECRUITER" | "BUSINESS") ||
          "HUNTER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
