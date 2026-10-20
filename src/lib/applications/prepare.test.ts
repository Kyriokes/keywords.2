import { describe, expect, it } from "vitest";
import { buildCoverLetterPrompt, cleanCoverLetter, computeMatchScore, pickTemplate } from "./prepare";
import { WRITING_GUIDE } from "./voice";

const LETTER = "Estimado equipo:\n\n" + "Me interesa mucho el puesto y creo que mi experiencia encaja. ".repeat(6) + "\n\nSaludos,\nAna";

describe("computeMatchScore", () => {
    it("es el porcentaje de keywords de la oferta que están en el CV", () => {
        expect(computeMatchScore(["a", "b", "c", "d"], ["a", "c", "z"])).toBe(50);
        expect(computeMatchScore(["a", "a", "b"], ["a"])).toBe(50);
    });

    it("devuelve null si falta la oferta o el CV para comparar", () => {
        expect(computeMatchScore([], ["a"])).toBeNull();
        expect(computeMatchScore(["a"], [])).toBeNull();
    });
});

describe("buildCoverLetterPrompt", () => {
    const base = { jobTitle: "Frontend Developer", jobDescription: "React y TypeScript", cvText: "Ana, 5 años con React" };

    it("incluye la carta modelo solo si existe", () => {
        expect(buildCoverLetterPrompt(base)).not.toContain("###MODELO###");
        expect(buildCoverLetterPrompt({ ...base, template: "Hola, soy Ana..." })).toContain("Hola, soy Ana...");
    });

    it("pide una carta breve y natural, sin título ni fórmulas solemnes", () => {
        const prompt = buildCoverLetterPrompt(base);
        expect(prompt).toContain("80 y 130 palabras");
        expect(prompt).toContain("Sin título");
        expect(prompt).not.toContain("150 y 250");
    });

    it("saluda al equipo de la empresa cuando se la conoce", () => {
        expect(buildCoverLetterPrompt({ ...base, company: "Acme" })).toContain('"Hola equipo de Acme,"');
        expect(buildCoverLetterPrompt(base)).toContain('"Hola,"');
    });

    it("usa la carta modelo solo como fuente de datos, no por su tono ni su largo", () => {
        const prompt = buildCoverLetterPrompt({ ...base, template: "Estimado equipo de selección: me dirijo a ustedes..." });
        expect(prompt).toContain("solo como fuente de datos");
        expect(prompt).not.toContain("respetá su tono");
    });

    it("recorta la descripción y el CV largos", () => {
        const prompt = buildCoverLetterPrompt({ ...base, jobDescription: "x".repeat(20_000), cvText: "y".repeat(20_000) });
        expect(prompt.length).toBeLessThan(16_000);
    });

    it("incluye la guía de redacción y la lista de muletillas a evitar", () => {
        const prompt = buildCoverLetterPrompt(base);
        expect(prompt).toContain(WRITING_GUIDE);
        expect(prompt).toContain("No uses estas frases ni parecidas: me dirijo a ustedes, estimado/a,");
        expect(prompt).not.toContain("Tono natural y directo");
    });

    it("pide reescribir sin las muletillas de la versión anterior", () => {
        expect(buildCoverLetterPrompt({ ...base, avoid: ["leverage", "fast-paced"] })).toContain(
            "La versión anterior usó: leverage, fast-paced. Reescribila sin esas frases ni equivalentes."
        );
        expect(buildCoverLetterPrompt(base)).not.toContain("La versión anterior");
    });

    it("nombra el idioma de la carta y lo repite al final, en ese idioma", () => {
        const english = buildCoverLetterPrompt({ ...base, language: "en" });
        expect(english).toContain("- Escribila en inglés, aunque estas instrucciones estén en castellano.");
        expect(english.endsWith("Write the whole letter in English.")).toBe(true);
        expect(buildCoverLetterPrompt({ ...base, language: "es" }).endsWith("Escribí toda la carta en castellano.")).toBe(true);
    });

    it("pide no nombrar las tecnologías de la oferta que no están en el CV", () => {
        expect(buildCoverLetterPrompt({ ...base, missingSkills: ["Go", "GORM"] })).toContain(
            "- La oferta pide Go, GORM y el CV no los menciona: no los nombres ni digas que tenés experiencia con ellos."
        );
        expect(buildCoverLetterPrompt(base)).not.toContain("La oferta pide");
    });

    it("en el reintento señala las tecnologías inventadas y el idioma equivocado", () => {
        const prompt = buildCoverLetterPrompt({ ...base, language: "en", unsupported: ["Go"], wrongLanguage: true });
        expect(prompt).toContain("- La versión anterior nombró tecnologías que no están en el CV (Go). Sacalas.");
        expect(prompt).toContain("- La versión anterior no estaba en inglés.");
    });
});

describe("pickTemplate", () => {
    const spanish = { text: "Hola equipo, soy desarrollador y trabajo con React en el Instituto de Ayuda Financiera." };
    const english = { text: "Hi team, I'm a developer and I work with React at the Instituto de Ayuda Financiera." };

    it("elige la carta modelo en el idioma de la oferta", () => {
        expect(pickTemplate([spanish, english], "en")).toBe(english.text);
        expect(pickTemplate([english, spanish], "es")).toBe(spanish.text);
    });

    it("sin una en ese idioma usa la primera, y sin modelos devuelve null", () => {
        expect(pickTemplate([spanish], "en")).toBe(spanish.text);
        expect(pickTemplate([], "en")).toBeNull();
    });
});

describe("cleanCoverLetter", () => {
    it("saca la introducción del modelo y los bloques de código", () => {
        expect(cleanCoverLetter(`Aquí está tu carta:\n${LETTER}`, 20_000)).toBe(LETTER);
        expect(cleanCoverLetter("```\n" + LETTER + "\n```", 20_000)).toBe(LETTER);
        expect(cleanCoverLetter(`<think>pensando</think>\n${LETTER}`, 20_000)).toBe(LETTER);
    });

    it("saca los títulos y el asunto que agrega el modelo", () => {
        for (const title of [
            "Carta de presentación",
            "# Cover Letter",
            "**Carta de presentación – Frontend Developer**",
            "Asunto: Postulación a Frontend Developer",
            "Subject: Application for Frontend Developer",
        ]) {
            expect(cleanCoverLetter(`${title}\n\n${LETTER}`, 20_000), title).toBe(LETTER);
        }
    });

    it("descarta respuestas cortas o con marcadores sin completar", () => {
        expect(cleanCoverLetter("Hola", 20_000)).toBeNull();
        expect(cleanCoverLetter(LETTER.replace("Estimado equipo", "Estimado equipo de [Empresa]"), 20_000)).toBeNull();
    });
});
