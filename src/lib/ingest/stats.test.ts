import { describe, expect, it } from "vitest";
import { emptySourceStats, sourceLabel, sourceOf } from "./stats";

describe("sourceOf", () => {
    it("separa el board de las fuentes de ATS", () => {
        expect(sourceOf({ source: "greenhouse", externalId: "stripe:456" })).toEqual({ source: "greenhouse", board: "stripe" });
        expect(sourceOf({ source: "smartrecruiters", externalId: "endava:ab:12" })).toEqual({ source: "smartrecruiters", board: "endava" });
    });
    it("los agregadores no tienen board", () => {
        expect(sourceOf({ source: "remotive", externalId: "123" })).toEqual({ source: "remotive", board: null });
    });
});

describe("sourceLabel", () => {
    it("usa el nombre del portal y nombra los orígenes manuales", () => {
        expect(sourceLabel("getonbrd")).toBe("Get on Board (LatAm)");
        expect(sourceLabel("manual")).toBe("Cargadas a mano");
        expect(sourceLabel("agent")).toBe("Cargadas desde Claude");
        expect(sourceLabel(null)).toBe("Sin origen");
        expect(sourceLabel("otro")).toBe("otro");
    });
});

describe("emptySourceStats", () => {
    it("arranca todo en cero y sin error", () => {
        expect(emptySourceStats()).toEqual({ fetched: 0, fresh: 0, matchedRole: 0, passed: 0, rejected: 0, error: null });
    });
});
