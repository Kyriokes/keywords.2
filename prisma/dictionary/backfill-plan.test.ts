import { describe, expect, it } from "vitest";
import { planKeywordBackfill, type PlanKeyword } from "./backfill-plan";

const keyword = (id: string, name: string, extra: Partial<PlanKeyword> = {}): PlanKeyword => ({
    id,
    name,
    isApproved: false,
    aliasKeys: [],
    ...extra,
});

describe("planKeywordBackfill", () => {
    it("fusiona una keyword vieja con la entrada del diccionario que tiene su clave", () => {
        const steps = planKeywordBackfill([
            keyword("dict-react", "React", { isApproved: true, aliasKeys: ["react", "reactjs"] }),
            keyword("old-1", "react.js"),
            keyword("old-2", "reactjs"),
        ]);

        expect(steps).toEqual([
            { type: "merge", sourceId: "old-1", targetId: "dict-react" },
            { type: "merge", sourceId: "old-2", targetId: "dict-react" },
        ]);
    });

    it("une entre sí las variantes sin verificar del mismo término", () => {
        const steps = planKeywordBackfill([
            keyword("a", "control de calidad"),
            keyword("b", "Control de Calidad"),
            keyword("c", "control-de-calidad"),
        ]);

        // La primera por orden alfabético se queda con el alias; las otras se fusionan en ella
        expect(steps.filter((step) => step.type === "alias")).toHaveLength(1);
        expect(steps.filter((step) => step.type === "merge")).toHaveLength(2);
        const owner = steps.find((step) => step.type === "alias");
        for (const step of steps) {
            if (step.type === "merge") expect(step.targetId).toBe(owner?.type === "alias" && owner.keywordId);
        }
    });

    it("le crea su alias a un término que nadie más tiene", () => {
        expect(planKeywordBackfill([keyword("x", "Proactividad")])).toEqual([
            { type: "alias", keywordId: "x", aliasText: "proactividad" },
        ]);
    });

    it("no toca keywords que ya tienen alias ni nombres sin clave", () => {
        const steps = planKeywordBackfill([
            keyword("ok", "Docker", { isApproved: true, aliasKeys: ["docker"] }),
            keyword("noise", "---"),
        ]);
        expect(steps).toEqual([]);
    });

    it("nunca borra una entrada verificada", () => {
        const steps = planKeywordBackfill([
            keyword("dict-1", "Node.js", { isApproved: true, aliasKeys: ["nodejs"] }),
            keyword("dict-2", "NodeJS", { isApproved: true }),
        ]);
        expect(steps).toEqual([]);
    });
});
