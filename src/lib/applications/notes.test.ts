import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/validation";
import { appendNote } from "./notes";

describe("appendNote", () => {
    it("deja el resumen del ingreso primero y la novedad debajo", () => {
        expect(appendNote("Remoto · match 58%", "Enviada por Ashby el 20/10/2026")).toBe("Remoto · match 58%\nEnviada por Ashby el 20/10/2026");
    });

    it("sin notas previas queda solo la línea nueva", () => {
        expect(appendNote(null, "  Descartada: Repetida ")).toBe("Descartada: Repetida");
        expect(appendNote(undefined, "Descartada")).toBe("Descartada");
    });

    it("no repite una línea que ya estaba", () => {
        expect(appendNote("Remoto\nDescartada: Repetida", "Descartada: Repetida")).toBe("Remoto\nDescartada: Repetida");
    });

    it("una línea vacía no cambia nada", () => {
        expect(appendNote("Remoto", "   ")).toBe("Remoto");
    });

    it("respeta el largo máximo de las notas", () => {
        expect(appendNote("a".repeat(LIMITS.notes), "más").length).toBe(LIMITS.notes);
    });
});
