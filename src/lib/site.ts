// Datos públicos del sitio que comparten los metadatos, robots.txt, el sitemap y los datos estructurados.

/** Dominio de producción en Vercel; fuera de Vercel se usa el público conocido. */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://kwtools.vercel.app";

export const SITE_NAME = "KeyWords";

/** Color de fondo del modo oscuro y del ícono: el que usa el navegador para la barra en el celular. */
export const THEME_DARK = "#181818";
export const THEME_LIGHT = "#ffffff";

/** Rutas que no tienen sentido en un buscador: requieren sesión o son pasos del inicio de sesión. */
export const PRIVATE_PATHS = ["/user/", "/admin", "/api/", "/login/oauth-error", "/unauthorized"];
