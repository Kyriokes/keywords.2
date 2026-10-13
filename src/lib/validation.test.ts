import { describe, expect, it } from "vitest";
import { createApplicationSchema, parseApplicationDate, parseApplicationStatus } from "./validation";

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
