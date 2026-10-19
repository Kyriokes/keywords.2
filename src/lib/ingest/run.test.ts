import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
    position: { findMany: vi.fn() },
    cV: { findFirst: vi.fn() },
    jobApplication: { findMany: vi.fn() },
    cVKeyword: { findMany: vi.fn() },
    jobSearchSettings: { update: vi.fn() },
}));
const create = vi.hoisted(() => vi.fn());
const fetchAggregator = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("@/lib/applications/create", () => ({ createApplicationForProfile: create }));
// Cada keyword de la descripción es una palabra en mayúsculas: "REACT NODE" → react, node
vi.mock("@/lib/keywords/dictionary", () => ({
    detectKeywords: async (text: string) => (text.match(/\b[A-Z]{2,}\b/g) ?? []).map((word) => ({ id: word.toLowerCase() })),
}));
vi.mock("@/lib/positions/dictionary", () => ({
    classifyJobTitle: async (title: string) => ({
        roleId: "role-fs",
        roleName: "Full Stack Developer",
        seniority: /senior/i.test(title) ? "SENIOR" : null,
        core: title.toLowerCase(),
    }),
}));
vi.mock("./sources", async (importOriginal) => ({ ...(await importOriginal<typeof import("./sources")>()), fetchAggregator }));

import { runJobSearch, type SearchSettingsInput } from "./run";

const settings: SearchSettingsInput = {
    sources: ["remotive"],
    atsBoards: [],
    minScore: 40,
    maxPerRun: 10,
    workModes: ["REMOTE", "REMOTE_US_HOURS", "HYBRID"],
    seniorityPolicy: "FLEXIBLE",
};

const job = (id: string, fields: Record<string, unknown>) => ({
    source: "remotive",
    externalId: id,
    title: "Full Stack Developer",
    company: "Acme",
    url: `https://remotive.com/${id}`,
    applyUrl: null,
    description: "REACT NODE",
    location: "Worldwide",
    ...fields,
});

beforeEach(() => {
    vi.clearAllMocks();
    db.position.findMany.mockResolvedValue([{ title: "Full Stack Developer" }]);
    db.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    db.jobApplication.findMany.mockResolvedValue([]);
    db.cVKeyword.findMany.mockResolvedValue(["react", "node", "typescript"].map((keywordId) => ({ keywordId })));
    create.mockResolvedValue({ ok: true, data: {} });
    fetchAggregator.mockResolvedValue([
        job("1", {}),
        job("2", { location: "USA" }),
        job("3", { title: "Senior Full Stack Developer", description: "REACT GO RUST" }),
        job("4", { applyUrl: "https://acme.wd5.myworkdayjobs.com/job/4" }),
    ]);
});

describe("runJobSearch", () => {
    it("deja en la cola solo las ofertas que pasan los filtros", async () => {
        const result = await runJobSearch("profile-1", settings);

        expect(create).toHaveBeenCalledTimes(2);
        expect(create).toHaveBeenCalledWith(
            "profile-1",
            expect.objectContaining({ externalId: "remotive:1", applyMode: "EXTERNAL_FORM", notes: "Remoto · match 100%", score: 100 })
        );
        // El formulario está en Workday, que pide cuenta: lo envía el usuario
        expect(create).toHaveBeenCalledWith("profile-1", expect.objectContaining({ externalId: "remotive:4", applyMode: "UNSUPPORTED" }));
        expect(result.created).toBe(2);
        expect(result.filtered).toBe(2);
        expect(result.summary).toBe("4 ofertas revisadas, 4 de tus puestos, 2 descartadas por los filtros, 2 nuevas en la cola.");
    });

    it("explica por qué descartó cada oferta", async () => {
        const result = await runJobSearch("profile-1", settings);

        expect(result.decisions.map((decision) => [decision.externalId, decision.status, decision.reason])).toEqual([
            ["remotive:1", "QUEUED", null],
            ["remotive:2", "REJECTED", "Solo para USA"],
            ["remotive:3", "REJECTED", "Match 33% (mínimo 60%)"],
            ["remotive:4", "QUEUED", null],
        ]);
    });

    it("en modo prueba no guarda nada", async () => {
        const result = await runJobSearch("profile-1", settings, new Map(), { dryRun: true });

        expect(create).not.toHaveBeenCalled();
        expect(result.decisions.filter((decision) => decision.status === "PASSES")).toHaveLength(2);
        expect(result.summary).toBe("4 ofertas revisadas, 4 de tus puestos, 2 descartadas por los filtros, 2 entrarían a la cola.");
    });
});
