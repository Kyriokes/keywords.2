// Evitamos importar de @prisma/client para asegurar compatibilidad con Edge Runtime
export type UserRole = "ADMIN" | "HUNTER" | "RECRUITER" | "BUSINESS";

/**
 * Define las rutas públicas que no requieren autenticación.
 * Se comparan por igualdad exacta; `/api/auth` además incluye todas sus subrutas.
 */
export const publicRoutes = [
  "/",
  "/login",
  "/login/oauth-error",
  "/api/auth", // Rutas internas de NextAuth
  "/opengraph-image", // Imagen para compartir: la piden las redes, sin sesión
  "/api/mcp", // Servidor MCP para agentes: se autentica con el token personal, no con la cookie
];

/**
 * Diccionario de rutas protegidas y los roles que tienen acceso a ellas.
 * NOTA: El rol ADMIN tiene acceso a todo por defecto (se manejará en el proxy),
 * por lo que no es estrictamente necesario incluirlo en cada array, pero
 * puedes hacerlo para mayor claridad.
 */
export const protectedRoutes: Record<string, UserRole[]> = {
  "/admin": ["ADMIN"],
  "/api/admin": ["ADMIN"],
  "/api/debug": ["ADMIN"],
  "/user": ["HUNTER", "ADMIN"],
  "/recruiter": ["RECRUITER", "ADMIN"],
  "/business": ["BUSINESS", "ADMIN"],
};

/**
 * Ruta por defecto a la que se redirige después de hacer login
 * si no se especifica otra.
 */
export const DEFAULT_LOGIN_REDIRECT = "/user/dashboard";

/**
 * Ruta para usuarios que intentan acceder a una vista sin los permisos necesarios.
 */
export const UNAUTHORIZED_REDIRECT = "/unauthorized";
