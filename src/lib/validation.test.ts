import { describe, expect, it } from "vitest";
import {
    answerTemplateSchema,
    createApplicationSchema,
    mediaAssetSchema,
    parseApplicationDate,
    parseApplicationStatus,
} from "./validation";

const NOW = new Date("2026-10-13T15:00:00.000Z");

describe("parseApplicationDate", () => {
    it("acepta una fecha pasada en formato AAAA-MM-DD", () => {
        expect(parseApplicationDate("2026-03-09", NOW)?.toISOString().slice(0, 10)).toBe("2026-03-09");
    });

    it("acepta la fecha de hoy aunque el servidor todavía esté en el día anterior", () => {
        expect(parseApplicationDate("2026-10-14", NOW)).toBeInstanceOf(Date);
    });

    it("descarta lo que no es una fecha real, pasada y razonable", () => {
        const invalid = [undefined, null, 45000, "", "ayer", "09/03/2026", "2026-02-31", "2026-13-01", "1999-12-31", "2027-01-01"];
        for (const value of invalid) {
            expect(parseApplicationDate(value, NOW), String(value)).toBeUndefined();
        }
    });
});

describe("parseApplicationStatus", () => {
    it("conserva los estados conocidos y descarta el resto", () => {
        expect(parseApplicationStatus("INTERVIEW")).toBe("INTERVIEW");
        expect(parseApplicationStatus("entrevista")).toBeUndefined();
        expect(parseApplicationStatus(undefined)).toBeUndefined();
    });
});

describe("createApplicationSchema", () => {
    const base = { jobTitle: "Frontend Developer", jobDescription: "", detectedWords: [] };

    it("deja fecha y estado sin definir cuando no vienen, para que la base ponga los suyos", () => {
        const parsed = createApplicationSchema.parse(base);
        expect(parsed.date).toBeUndefined();
        expect(parsed.status).toBeUndefined();
    });

    it("conserva la fecha y el estado de una postulación importada", () => {
        const parsed = createApplicationSchema.parse({ ...base, date: "2025-11-20", status: "REJECTED" });
        expect(parsed.date?.toISOString().slice(0, 10)).toBe("2025-11-20");
        expect(parsed.status).toBe("REJECTED");
    });

    it("no rechaza la postulación por una fecha o un estado inválidos: los ignora", () => {
        const parsed = createApplicationSchema.parse({ ...base, date: "no es fecha", status: "CONTRATADO" });
        expect(parsed.date).toBeUndefined();
        expect(parsed.status).toBeUndefined();
    });
});

describe("campos de postulación asistida", () => {
    const base = { jobTitle: "Frontend Developer", jobDescription: "", detectedWords: [] };

    it("acepta los estados de la cola", () => {
        for (const status of ["READY", "APPROVED", "SKIPPED", "NEEDS_USER"]) {
            expect(parseApplicationStatus(status)).toBe(status);
        }
    });

    it("normaliza empresa y link del formulario, y deja afuera lo vacío", () => {
        const parsed = createApplicationSchema.parse({ ...base, company: "  Acme  ", applyUrl: "boards.greenhouse.io/acme/1", source: "" });
        expect(parsed.company).toBe("Acme");
        expect(parsed.applyUrl).toBe("https://boards.greenhouse.io/acme/1");
        expect(parsed.source).toBeUndefined();
    });

    it("rechaza un modo de envío desconocido o un link de formulario inválido", () => {
        expect(createApplicationSchema.safeParse({ ...base, applyMode: "AUTO" }).success).toBe(false);
        expect(createApplicationSchema.safeParse({ ...base, applyUrl: "javascript:alert(1)" }).success).toBe(false);
    });
});

describe("answerTemplateSchema", () => {
    it("limpia las etiquetas: minúsculas, sin repetidas ni vacías", () => {
        const parsed = answerTemplateSchema.parse({ question: "Pretensión", answer: "USD 4000", tags: ["Salary", "salary", " ", "USD"] });
        expect(parsed.tags).toEqual(["salary", "usd"]);
    });

    it("exige pregunta y respuesta", () => {
        expect(answerTemplateSchema.safeParse({ question: " ", answer: "x" }).success).toBe(false);
        expect(answerTemplateSchema.safeParse({ question: "x", answer: "" }).success).toBe(false);
    });
});

describe("mediaAssetSchema", () => {
    it("solo acepta links http(s)", () => {
        expect(mediaAssetSchema.parse({ name: "Video", url: "youtu.be/abc" }).url).toBe("https://youtu.be/abc");
        expect(mediaAssetSchema.safeParse({ name: "Video", url: "javascript:alert(1)" }).success).toBe(false);
    });
});
