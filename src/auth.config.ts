import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Log detallado para depuración
      console.log(`[AUTH-DEBUG] JWT Callback - Trigger: ${trigger || "unknown"}`);

      if (user) {
        console.log(
          `[AUTH-DEBUG] User encontrado en JWT (Login/Registro):`,
          JSON.stringify(user, null, 2)
        );
        token.id = user.id;
        // Forzamos un valor por defecto si role es undefined, pero preferimos el de la DB
        token.role = user.role || "HUNTER";
      }

      // Si el usuario actualiza su sesión manualmente
      if (trigger === "update" && session?.user?.role) {
        token.role = session.user.role;
      }

      console.log(`[AUTH-DEBUG] Token final:`, JSON.stringify(token, null, 2));
      return token;
    },
    session({ session, token }) {
      console.log(`[AUTH-DEBUG] Session Callback - Token Role: ${token.role}`);

      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role =
          (token.role as "ADMIN" | "HUNTER" | "RECRUITER" | "BUSINESS") ||
          "HUNTER";
      }

      console.log(
        `[AUTH-DEBUG] Session final:`,
        JSON.stringify(session, null, 2)
      );
      return session;
    },
  },
} satisfies NextAuthConfig;
