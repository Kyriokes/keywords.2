import { describe, expect, it } from "vitest";
import { LEARNED_FROM, isPreferenceKind, normalizePreferenceKey } from "./kinds";

describe("normalizePreferenceKey", () => {
    it("iguala mayúsculas, acentos y espacios de más", () => {
        expect(normalizePreferenceKey("  Node.JS ")).toBe("node.js");
        expect(normalizePreferenceKey("Alemán  fluido")).toBe("aleman fluido");
        expect(normalizePreferenceKey("PHP")).toBe(normalizePreferenceKey("php"));
    });
});

describe("LEARNED_FROM", () => {
    it("aprende solo de los descartes por tecnología y por empresa", () => {
        expect(LEARNED_FROM.TECH).toBe("AVOID_TECH");
        expect(LEARNED_FROM.COMPANY).toBe("AVOID_COMPANY");
        expect(LEARNED_FROM.LANGUAGE).toBeUndefined();
        expect(LEARNED_FROM.OTHER).toBeUndefined();
    });
});

describe("isPreferenceKind", () => {
    it("reconoce los tipos conocidos", () => {
        expect(isPreferenceKind("AVOID_TECH")).toBe(true);
        expect(isPreferenceKind("AVOID_ALL")).toBe(false);
        expect(isPreferenceKind(null)).toBe(false);
    });
});
