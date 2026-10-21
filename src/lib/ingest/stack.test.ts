import { describe, expect, it } from "vitest";
import { requirementsSection } from "./stack";

describe("requirementsSection", () => {
    it("devuelve lo que sigue al encabezado de requisitos", () => {
        const section = requirementsSection("About us: we build things.\n\nRequirements\n- 3+ years with Go\n- Kafka\n\nBenefits\n- Remote");
        expect(section.startsWith("Requirements")).toBe(true);
        expect(section).toContain("Kafka");
    });

    it("entiende los encabezados en castellano", () => {
        expect(requirementsSection("Sobre nosotros... Requisitos: Java, Spring Boot. Ofrecemos: OSDE.")).toContain("Spring Boot");
        expect(requirementsSection("Lo que buscamos: experiencia con PHP y Laravel.")).toContain("Laravel");
    });

    it("sin encabezado devuelve vacío", () => {
        expect(requirementsSection("We use React and Node. Apply now.")).toBe("");
    });

    it("corta la sección a un largo razonable", () => {
        const section = requirementsSection(`Requirements ${"x".repeat(5_000)}`);
        expect(section.length).toBe(1_500);
    });
});
