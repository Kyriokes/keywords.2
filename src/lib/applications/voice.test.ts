import { describe, expect, it } from "vitest";
import { AI_TELLS, WRITING_GUIDE, findAiTells } from "./voice";

describe("findAiTells", () => {
    it("encuentra las muletillas en español e inglés sin importar mayúsculas", () => {
        expect(findAiTells("Me dirijo a ustedes porque soy una persona apasionada.")).toEqual(["me dirijo a ustedes", "apasionado/a"]);
        expect(findAiTells("I am thrilled to apply. I look forward to hearing from you!")).toEqual(["I am thrilled/excited", "I look forward to hearing from you"]);
    });

    it("devuelve cada muletilla una sola vez, en el orden en que aparecen", () => {
        expect(findAiTells("We leverage data. Robust and seamless. Leverage again.")).toEqual(["leverage", "robust", "seamless"]);
    });

    it("reconoce las muletillas escritas con apóstrofo curvo", () => {
        expect(findAiTells("Dear Hiring Team, I’m writing to apply. I’d be a great fit.")).toEqual([
            "Dear Hiring Manager",
            "I am writing to",
            "I would be a great fit",
        ]);
    });

    it("no marca nada en un texto normal", () => {
        expect(findAiTells("Hola equipo de Acme, vi el puesto de Full Stack. En KeyWords armé el pipeline de keywords con Node y Prisma.")).toEqual([]);
    });
});

describe("WRITING_GUIDE", () => {
    it("nombra las muletillas más comunes para que el modelo las evite", () => {
        expect(WRITING_GUIDE).toContain("me dirijo a ustedes");
        expect(WRITING_GUIDE).toContain("I look forward to hearing from you");
        expect(AI_TELLS.length).toBeGreaterThan(20);
    });
});
