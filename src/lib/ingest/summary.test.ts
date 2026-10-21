import { describe, expect, it } from "vitest";
import { buildNotes, publishedAgo } from "./summary";

const now = new Date("2026-10-20T15:00:00.000Z");

describe("publishedAgo", () => {
    it("cuenta los días desde la publicación", () => {
        expect(publishedAgo("2026-10-20T08:00:00.000Z", now)).toBe("publicada hoy");
        expect(publishedAgo("2026-10-19T08:00:00.000Z", now)).toBe("publicada ayer");
        expect(publishedAgo("2026-10-14T08:00:00.000Z", now)).toBe("publicada hace 6 días");
    });

    it("sin fecha o con una fecha ilegible no dice nada", () => {
        expect(publishedAgo(undefined, now)).toBeUndefined();
        expect(publishedAgo("ayer", now)).toBeUndefined();
    });
});

describe("buildNotes", () => {
    it("junta resumen, fecha, match, lo que falta y las advertencias", () => {
        expect(
            buildNotes(
                { summary: "Remoto · pide 3 años", publishedAt: "2026-10-18T08:00:00.000Z", score: 58, missing: ["Go", "Kafka", "Redis", "Kubernetes"], warnings: ["menciona viajes"] },
                now
            )
        ).toBe("Remoto · pide 3 años · publicada hace 2 días · match 58% · falta: Go, Kafka, Redis · menciona viajes");
    });

    it("sin extras queda como antes", () => {
        expect(buildNotes({ summary: "Remoto", score: 100, missing: [], warnings: [] }, now)).toBe("Remoto · match 100%");
        expect(buildNotes({ summary: "", score: 45, missing: [], warnings: [] }, now)).toBe("match 45%");
    });
});
