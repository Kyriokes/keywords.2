import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({ jobApplication: { findMany: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ default: db }));

const dictionary = vi.hoisted(() => ({ detectKeywords: vi.fn() }));
vi.mock("@/lib/keywords/dictionary", () => dictionary);

const preferences = vi.hoisted(() => ({ savePreference: vi.fn() }));
vi.mock("@/lib/preferences/preferences", () => preferences);

import { skipApplications } from "./skip";

const QUEUE = ["READY", "APPROVED", "NEEDS_USER"];

beforeEach(() => {
    vi.clearAllMocks();
    dictionary.detectKeywords.mockResolvedValue([]);
    preferences.savePreference.mockResolvedValue({ ok: true, data: { id: "p1", value: "PHP", created: true } });
});

describe("skipApplications", () => {
    it("descarta con motivo, suma la línea a las notas y aprende la tecnología", async () => {
        db.jobApplication.findMany.mockResolvedValue([{ id: "app-1", company: "Ready", jobTitle: "Full Stack (Node + PHP)", notes: "Remoto · match 63%" }]);
        dictionary.detectKeywords.mockResolvedValue([{ id: "kw-php", name: "PHP", category: "LENGUAJE", count: 1 }]);

        const result = await skipApplications("profile-1", [{ id: "app-1", reason: "TECH", detail: "php" }], QUEUE);

        expect(db.jobApplication.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: { in: ["app-1"] }, profileId: "profile-1", status: { in: QUEUE } } })
        );
        expect(db.jobApplication.update).toHaveBeenCalledWith({
            where: { id: "app-1" },
            data: { status: "SKIPPED", skipReason: "TECH", skipDetail: "php", notes: "Remoto · match 63%\nDescartada: Tecnología que no tenés (php)" },
        });
        expect(preferences.savePreference).toHaveBeenCalledWith("profile-1", {
            kind: "AVOID_TECH",
            value: "PHP",
            origin: "LEARNED",
            note: expect.stringContaining("Descartaste Ready (Full Stack (Node + PHP)) el "),
        });
        expect(result).toEqual({ skipped: ["app-1"], learned: [{ kind: "AVOID_TECH", value: "PHP" }] });
    });

    it("un descarte por empresa aprende la empresa de la oferta cuando no viene el detalle", async () => {
        db.jobApplication.findMany.mockResolvedValue([{ id: "app-2", company: "Fueled", jobTitle: "Full Stack Web Engineer", notes: null }]);
        preferences.savePreference.mockResolvedValue({ ok: true, data: { id: "p2", value: "Fueled", created: true } });

        const result = await skipApplications("profile-1", [{ id: "app-2", reason: "COMPANY" }], QUEUE);

        expect(preferences.savePreference).toHaveBeenCalledWith("profile-1", expect.objectContaining({ kind: "AVOID_COMPANY", value: "Fueled" }));
        expect(result.learned).toEqual([{ kind: "AVOID_COMPANY", value: "Fueled" }]);
    });

    it("una preferencia que ya existía no se cuenta como aprendida", async () => {
        db.jobApplication.findMany.mockResolvedValue([{ id: "app-1", company: "Ready", jobTitle: "Dev", notes: null }]);
        preferences.savePreference.mockResolvedValue({ ok: true, data: { id: "p1", value: "PHP", created: false } });

        const result = await skipApplications("profile-1", [{ id: "app-1", reason: "TECH", detail: "PHP" }], QUEUE);

        expect(result.learned).toEqual([]);
    });

    it("sin motivo descarta igual y no aprende nada", async () => {
        db.jobApplication.findMany.mockResolvedValue([{ id: "app-3", company: null, jobTitle: "Dev", notes: "Remoto" }]);

        const result = await skipApplications("profile-1", [{ id: "app-3" }], QUEUE);

        expect(db.jobApplication.update.mock.calls[0][0].data).toMatchObject({ status: "SKIPPED", skipReason: null, skipDetail: null, notes: "Remoto\nDescartada" });
        expect(preferences.savePreference).not.toHaveBeenCalled();
        expect(result).toEqual({ skipped: ["app-3"], learned: [] });
    });

    it("ignora las ofertas que no son del perfil o no están en un estado permitido", async () => {
        db.jobApplication.findMany.mockResolvedValue([]);
        const result = await skipApplications("profile-1", [{ id: "app-de-otro", reason: "TECH", detail: "Go" }], QUEUE);
        expect(db.jobApplication.update).not.toHaveBeenCalled();
        expect(result).toEqual({ skipped: [], learned: [] });
    });
});
