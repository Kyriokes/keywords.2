import { describe, expect, it } from "vitest";
import { isAdaptedText, latestAdaptedByTemplate } from "./answers";

describe("isAdaptedText", () => {
    it("acepta un texto escrito para la oferta", () => {
        expect(isAdaptedText("Vi que trabajan con Next.js y Prisma, el mismo stack de KeyWords.")).toBe(true);
    });

    it("rechaza las opciones de un desplegable y los datos cortos", () => {
        for (const option of ["Yes", "No", "Other", "$25,000 - $30,000", "Argentine", "GMT-3, cubro EST"]) {
            expect(isAdaptedText(option), option).toBe(false);
        }
    });
});

describe("latestAdaptedByTemplate", () => {
    it("toma la primera respuesta válida de cada plantilla, en el orden recibido", () => {
        const latest = latestAdaptedByTemplate([
            { templateId: "salario", answer: "$25,000 - $30,000" },
            { templateId: "motivo", answer: "Me interesa porque el producto resuelve algo que uso todos los días." },
            { templateId: "motivo", answer: "Una versión anterior, más vieja, que también cuenta como texto." },
            { templateId: null, answer: "Sin plantilla, no cuenta aunque sea un texto largo de verdad." },
        ]);
        expect(latest.get("motivo")).toBe("Me interesa porque el producto resuelve algo que uso todos los días.");
        expect(latest.has("salario")).toBe(false);
        expect(latest.size).toBe(1);
    });
});
