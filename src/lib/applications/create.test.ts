import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
    jobApplication: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    position: { findFirst: vi.fn() },
    cV: { findFirst: vi.fn() },
    cVKeyword: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("@/lib/keywords/dictionary", () => ({
    detectKeywords: async () => [{ id: "react" }, { id: "node" }],
    resolveTerms: async () => [],
}));
vi.mock("@/lib/positions/dictionary", () => ({
    classifyJobTitle: async () => ({ roleId: "role-fs", roleName: "Full Stack Developer", seniority: null, core: "full stack" }),
}));

import { createApplicationForProfile } from "./create";

const base = { jobTitle: "Full Stack Developer", jobDescription: "React y Node", detectedWords: [] };

beforeEach(() => {
    vi.clearAllMocks();
    db.jobApplication.count.mockResolvedValue(0);
    db.jobApplication.findFirst.mockResolvedValue(null);
    db.position.findFirst.mockResolvedValue(null);
    db.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    db.cVKeyword.findMany.mockResolvedValue([{ keywordId: "react" }]);
    db.jobApplication.create.mockImplementation(async ({ data }) => ({ id: "app-1", ...data }));
});

describe("createApplicationForProfile", () => {
    it("calcula el match con el CV activo cuando no viene de afuera", async () => {
        await createApplicationForProfile("profile-1", base);

        expect(db.jobApplication.create.mock.calls[0][0].data.score).toBe(50);
    });

    it("con el match ya calculado (la búsqueda lo trae) no vuelve a leer las keywords del CV", async () => {
        await createApplicationForProfile("profile-1", { ...base, score: 80 });

        expect(db.cVKeyword.findMany).not.toHaveBeenCalled();
        expect(db.jobApplication.create.mock.calls[0][0].data.score).toBe(80);
    });

    it("hace los controles previos en paralelo, no uno detrás de otro", async () => {
        const started: string[] = [];
        let releaseCount!: () => void;
        db.jobApplication.count.mockImplementation(() => {
            started.push("count");
            return new Promise((resolve) => (releaseCount = () => resolve(0)));
        });
        db.cV.findFirst.mockImplementation(async () => {
            started.push("cv");
            return { id: "cv-1" };
        });

        const pending = createApplicationForProfile("profile-1", { ...base, link: "https://acme.com/1", positionTitle: "Full Stack Developer" });
        await new Promise((resolve) => setTimeout(resolve, 0));

        // El CV se pidió sin esperar a que terminara el conteo
        expect(started).toEqual(["count", "cv"]);
        releaseCount();
        await expect(pending).resolves.toMatchObject({ ok: true });
    });

    it("respeta el máximo de postulaciones y los links repetidos", async () => {
        db.jobApplication.count.mockResolvedValue(5_000);
        await expect(createApplicationForProfile("profile-1", base)).resolves.toMatchObject({ ok: false, code: "LIMIT_REACHED" });

        db.jobApplication.count.mockResolvedValue(0);
        db.jobApplication.findFirst.mockResolvedValue({ id: "old" });
        await expect(createApplicationForProfile("profile-1", { ...base, link: "https://acme.com/1" })).resolves.toMatchObject({
            ok: false,
            code: "DUPLICATE_LINK",
        });
        expect(db.jobApplication.create).not.toHaveBeenCalled();
    });
});
