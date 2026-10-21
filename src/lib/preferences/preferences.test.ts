import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
    searchPreference: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));

const dictionary = vi.hoisted(() => ({ detectKeywords: vi.fn() }));
vi.mock("@/lib/keywords/dictionary", () => dictionary);

import { LIMITS } from "@/lib/validation";
import { deletePreference, loadPreferenceRules, savePreference } from "./preferences";

beforeEach(() => {
    vi.clearAllMocks();
    db.searchPreference.count.mockResolvedValue(0);
});

describe("savePreference", () => {
    it("guarda el valor como vino y la clave normalizada", async () => {
        db.searchPreference.findUnique.mockResolvedValue(null);
        db.searchPreference.create.mockResolvedValue({ id: "p1" });

        const result = await savePreference("profile-1", { kind: "AVOID_TECH", value: " PHP ", origin: "LEARNED", note: "Descartaste Ready" });

        expect(result).toEqual({ ok: true, data: { id: "p1", value: "PHP", created: true } });
        expect(db.searchPreference.create).toHaveBeenCalledWith({
            data: { profileId: "profile-1", kind: "AVOID_TECH", value: "PHP", valueKey: "php", origin: "LEARNED", note: "Descartaste Ready" },
            select: { id: true },
        });
    });

    it("no duplica una preferencia que ya estaba, aunque cambie la escritura", async () => {
        db.searchPreference.findUnique.mockResolvedValue({ id: "p1", value: "PHP" });

        const result = await savePreference("profile-1", { kind: "AVOID_TECH", value: "php" });

        expect(result).toEqual({ ok: true, data: { id: "p1", value: "PHP", created: false } });
        expect(db.searchPreference.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { profileId_kind_valueKey: { profileId: "profile-1", kind: "AVOID_TECH", valueKey: "php" } } })
        );
        expect(db.searchPreference.create).not.toHaveBeenCalled();
    });

    it("respeta el máximo de preferencias y rechaza un valor vacío", async () => {
        db.searchPreference.findUnique.mockResolvedValue(null);
        db.searchPreference.count.mockResolvedValue(LIMITS.preferences);
        expect((await savePreference("profile-1", { kind: "AVOID_COMPANY", value: "Fueled" })).ok).toBe(false);

        expect(await savePreference("profile-1", { kind: "AVOID_COMPANY", value: "   " })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    });
});

describe("deletePreference", () => {
    it("borra solo dentro del perfil", async () => {
        db.searchPreference.deleteMany.mockResolvedValue({ count: 0 });
        expect(await deletePreference("profile-1", "p-de-otro")).toBe(false);
        expect(db.searchPreference.deleteMany).toHaveBeenCalledWith({ where: { id: "p-de-otro", profileId: "profile-1" } });
    });
});

describe("loadPreferenceRules", () => {
    it("traduce las tecnologías al diccionario y normaliza las empresas", async () => {
        db.searchPreference.findMany.mockResolvedValue([
            { kind: "AVOID_TECH", value: "PHP", valueKey: "php" },
            { kind: "AVOID_TECH", value: "Golang", valueKey: "golang" },
            { kind: "AVOID_COMPANY", value: "Fueled", valueKey: "fueled" },
            { kind: "AVOID_PHRASE", value: "talent pool", valueKey: "talent pool" },
        ]);
        dictionary.detectKeywords.mockImplementation(async (text: string) =>
            text === "PHP" ? [{ id: "kw-php", name: "PHP", category: "LENGUAJE", count: 1 }] : []
        );

        const rules = await loadPreferenceRules("profile-1");

        expect(rules.avoidTechNames).toEqual(["PHP", "Golang"]);
        expect(rules.avoidTechKeywordIds).toEqual(new Set(["kw-php"]));
        expect(rules.avoidCompanyKeys).toEqual(new Set(["fueled"]));
        expect(rules.avoidPhrases).toEqual(["talent pool"]);
    });

    it("sin preferencias no consulta el diccionario", async () => {
        db.searchPreference.findMany.mockResolvedValue([]);
        const rules = await loadPreferenceRules("profile-1");
        expect(rules.avoidTechKeywordIds.size).toBe(0);
        expect(dictionary.detectKeywords).not.toHaveBeenCalled();
    });
});
