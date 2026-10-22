import { describe, expect, it } from "vitest";
import { isPublicPath } from "./routes.config";

describe("isPublicPath", () => {
    it("los archivos que leen los buscadores se sirven sin sesión", () => {
        // Antes redirigían al login: Google no podía leer robots.txt ni el sitemap
        for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/opengraph-image"]) {
            expect(isPublicPath(path), path).toBe(true);
        }
    });

    it("la portada, el login y las rutas de Auth.js son públicas", () => {
        expect(isPublicPath("/")).toBe(true);
        expect(isPublicPath("/login")).toBe(true);
        expect(isPublicPath("/api/auth/callback/google")).toBe(true);
    });

    it("lo demás pide sesión, aunque empiece parecido", () => {
        for (const path of ["/user/dashboard", "/admin", "/robots.txt.bak", "/api/feedback", "/api/authx"]) {
            expect(isPublicPath(path), path).toBe(false);
        }
    });
});
