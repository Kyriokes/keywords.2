import NextAuth from "next-auth";
import authConfig from "./auth.config";
import {
  publicRoutes,
  protectedRoutes,
  UNAUTHORIZED_REDIRECT,
} from "./routes.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;
  const pathname = nextUrl.pathname;

  // 1. Check if the route is explicitly public
  // We can skip authentication for public routes like '/', '/login', '/api/auth'
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith("/api/auth")
  );

  // If the user is trying to access a protected route
  if (!isPublicRoute) {
    if (!isLoggedIn) {
      // Not logged in -> redirect to login
      let callbackUrl = pathname;
      if (nextUrl.search) {
        callbackUrl += nextUrl.search;
      }
      const encodedCallbackUrl = encodeURIComponent(callbackUrl);
      return Response.redirect(
        new URL(`/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
      );
    }

    // Check role-based access for the current pathname
    // Find if the path matches any prefix in protectedRoutes
    const protectedRoutePrefix = Object.keys(protectedRoutes).find((route) =>
      pathname.startsWith(route)
    );

    if (protectedRoutePrefix) {
      const allowedRoles = protectedRoutes[protectedRoutePrefix];

      // DEBUG: Verificando permisos
      console.log(`[Proxy] Ruta: ${pathname}`);
      console.log(`[Proxy] Rol detectado: ${userRole}`);
      console.log(`[Proxy] Roles permitidos: ${allowedRoles.join(", ")}`);

      // Si el rol es undefined, significa que la sesión no tiene el dato (sesión vieja o error de auth)
      // En este caso, redirigimos a login para forzar refresco, o a unauthorized si queremos ser estrictos.
      if (!userRole) {
         console.log("[Proxy] Rol no encontrado en sesión, redirigiendo a login para refrescar token");
         // Opción: Redirigir a login para que se regenere el token con el rol
         // return Response.redirect(new URL("/api/auth/signout", nextUrl)); // Drástico
         // Mejor mandamos a unauthorized con un mensaje o dejamos que falle en la siguiente linea.
      }

      // If the user doesn't have the required role, and is not an ADMIN
      if (userRole !== "ADMIN" && !allowedRoles.includes(userRole as any)) {
        console.log("[Proxy] Acceso DENEGADO");
        return Response.redirect(new URL(UNAUTHORIZED_REDIRECT, nextUrl));
      }
      
      console.log("[Proxy] Acceso PERMITIDO");
    }
  }

  return;
});

// Invokes the proxy on all paths except for static files and next internals
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
