import NextAuth from "next-auth";
import authConfig from "./auth.config";
import {
  publicRoutes,
  protectedRoutes,
  UNAUTHORIZED_REDIRECT,
} from "./routes.config";

const { auth } = NextAuth(authConfig);

// Coincide con la ruta exacta o con sus subrutas ("/user" no debe matchear "/users")
const isUnder = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(`${route}/`);

export default auth((req) => {
  const { nextUrl } = req;
  // Se exige un usuario en la sesión, no solo que `req.auth` exista
  const isLoggedIn = !!req.auth?.user;
  const userRole = req.auth?.user?.role;
  const pathname = nextUrl.pathname;

  // 1. Check if the route is explicitly public
  // We can skip authentication for public routes like '/', '/login', '/api/auth'
  const isPublicRoute =
    publicRoutes.includes(pathname) || isUnder(pathname, "/api/auth");

  if (isPublicRoute) {
    return;
  }

  // Las APIs responden con un status en lugar de redirigir a una página HTML
  const isApiRoute = isUnder(pathname, "/api");

  if (!isLoggedIn) {
    if (isApiRoute) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    isUnder(pathname, route)
  );

  if (protectedRoutePrefix) {
    const allowedRoles = protectedRoutes[protectedRoutePrefix];

    // If the user doesn't have the required role, and is not an ADMIN.
    // Una sesión sin rol (token viejo o error de auth) tampoco pasa.
    const hasAccess =
      userRole === "ADMIN" || (!!userRole && allowedRoles.includes(userRole));

    if (!hasAccess) {
      if (isApiRoute) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      return Response.redirect(new URL(UNAUTHORIZED_REDIRECT, nextUrl));
    }
  }

  return;
});

// Invokes the proxy on all paths except for static files and next internals
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
