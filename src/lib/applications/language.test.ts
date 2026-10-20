import { describe, expect, it } from "vitest";
import { detectLanguage } from "./language";

describe("detectLanguage", () => {
    it("reconoce una oferta en castellano aunque nombre tecnologías en inglés", () => {
        expect(detectLanguage("Buscamos un desarrollador Full Stack con experiencia en React, Node.js y bases de datos para el equipo de pagos.")).toBe("es");
    });

    it("reconoce una oferta en inglés", () => {
        expect(detectLanguage("We are looking for a Full Stack Engineer to join our team and build the tools that our customers use every day.")).toBe("en");
    });

    it("sin pistas claras, devuelve inglés", () => {
        expect(detectLanguage("")).toBe("en");
        expect(detectLanguage("React · Node.js · PostgreSQL")).toBe("en");
    });
});
