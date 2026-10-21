import { describe, expect, it } from "vitest";
import { detectAdLanguage, detectLanguage } from "./language";

const GERMAN =
    "Wir suchen einen Fullstack Entwickler für unser Team in Berlin. Du arbeitest mit React und Node.js und bist verantwortlich für die Entwicklung neuer Features. " +
    "Wir bieten ein modernes Arbeitsumfeld, flexible Arbeitszeiten und die Möglichkeit, remote zu arbeiten. Du bringst mehrere Jahre Erfahrung mit und sprichst fließend Deutsch. " +
    "Die Stelle ist ab sofort zu besetzen und wird unbefristet vergeben. Bewirb dich jetzt mit deinem Lebenslauf und wir melden uns bei dir.";

const GREEK = "Ζητείται προγραμματιστής για την ανάπτυξη εφαρμογών με React και Node.js. Απαραίτητη η γνώση της αγγλικής γλώσσας και εμπειρία σε παρόμοια θέση.";

describe("detectAdLanguage", () => {
    it("reconoce el castellano y el inglés como antes", () => {
        expect(detectAdLanguage("Buscamos un desarrollador Full Stack con experiencia en React, Node.js y bases de datos para el equipo de pagos.")).toBe("es");
        expect(detectAdLanguage("We are looking for a Full Stack Engineer to join our team and build the tools that our customers use every day.")).toBe("en");
    });

    it("marca como otro idioma un aviso en alemán o en otro alfabeto", () => {
        expect(detectAdLanguage(GERMAN)).toBe("other");
        expect(detectAdLanguage(GREEK)).toBe("other");
    });

    it("una cita corta en otro idioma dentro de un aviso en inglés no cambia el idioma", () => {
        expect(detectAdLanguage("We are looking for a developer who is fluent in German (Deutsch) to support our team with the customers and the product.")).toBe("en");
        expect(detectAdLanguage("Wir suchen dich")).toBe("en");
    });
});

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
