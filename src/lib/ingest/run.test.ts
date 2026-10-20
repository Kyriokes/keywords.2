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
// Cada keyword es una palabra en mayúsculas: "REACT NODE" → react, node. Las que terminan en "_TOOL" son herramientas.
vi.mock("@/lib/keywords/dictionary", () => ({
    detectKeywords: async (text: string) =>
        (text.match(/\b[A-Z][A-Z_]+\b/g) ?? []).map((word) => ({
            id: word.toLowerCase(),
            name: word,
            category: word.endsWith("_TOOL") ? "HERRAMIENTA" : "LENGUAJE",
        })),
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
    minRelocationSalaryUsd: null,
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

    it("descarta las que en el título piden tecnologías que no están en el CV", async () => {
        fetchAggregator.mockResolvedValue([
            job("5", { title: "GOLANG KUBERNETES Engineer" }),
            job("6", { title: "Full Stack Developer (REACT / JAVA)" }),
            job("7", { title: "Developer JIRA_TOOL" }),
        ]);

        const result = await runJobSearch("profile-1", settings, new Map(), { dryRun: true });

        expect(result.decisions.map((decision) => [decision.externalId, decision.status, decision.reason])).toEqual([
            ["remotive:5", "REJECTED", "El título pide GOLANG, KUBERNETES"],
            // Con una de las tecnologías del título alcanza
            ["remotive:6", "PASSES", null],
            // Las herramientas no cuentan como stack
            ["remotive:7", "PASSES", null],
        ]);
    });

    it("registra todas las ofertas que llegaron con su decisión y cuenta por fuente", async () => {
        const result = await runJobSearch("profile-1", settings);

        expect(result.offers.map((offer) => [offer.externalId, offer.decision, offer.reason])).toEqual([
            ["remotive:1", "QUEUED", null],
            ["remotive:2", "REJECTED", "Solo para USA"],
            ["remotive:3", "REJECTED", "Match 33% (mínimo 60%)"],
            ["remotive:4", "QUEUED", null],
        ]);
        expect(result.offers[0]).toMatchObject({ source: "remotive", board: null, company: "Acme", roleName: "Full Stack Developer", score: 100 });
        expect(result.fresh).toBe(4);
        expect(result.bySource).toEqual({ remotive: { fetched: 4, fresh: 4, matchedRole: 4, passed: 2, rejected: 2, error: null } });
    });

    it("registra las de otros puestos con el rol detectado, sin contarlas como descartadas", async () => {
        db.position.findMany.mockResolvedValue([{ title: "Backend Developer" }]);

        const result = await runJobSearch("profile-1", settings);

        expect(create).not.toHaveBeenCalled();
        expect(result.offers.every((offer) => offer.decision === "OTHER_ROLE" && offer.roleName === "Full Stack Developer")).toBe(true);
        expect(result.decisions).toEqual([]);
        expect(result).toMatchObject({ matchedRole: 0, filtered: 0, bySource: { remotive: expect.objectContaining({ fresh: 4, matchedRole: 0 }) } });
    });

    it("registra las que ya estaban en la cuenta sin volver a evaluarlas", async () => {
        db.jobApplication.findMany.mockResolvedValue([{ externalId: "remotive:1", link: "https://remotive.com/1" }]);

        const result = await runJobSearch("profile-1", settings);

        expect(result.offers[0]).toMatchObject({ externalId: "remotive:1", decision: "IN_ACCOUNT", roleName: null });
        expect(result.fresh).toBe(3);
        expect(result.bySource.remotive).toMatchObject({ fetched: 4, fresh: 3 });
    });

    it("sigue evaluando cuando la cola se llena y anota las que quedan para la próxima", async () => {
        const result = await runJobSearch("profile-1", { ...settings, maxPerRun: 1 });

        expect(create).toHaveBeenCalledTimes(1);
        expect(result.offers.map((offer) => offer.decision)).toEqual(["QUEUED", "REJECTED", "REJECTED", "PASSES"]);
        expect(result.deferred).toBe(1);
        expect(result.summary).toBe(
            "4 ofertas revisadas, 4 de tus puestos, 2 descartadas por los filtros, 1 nuevas en la cola. 1 más pasa los filtros y entra en la próxima búsqueda."
        );
    });

    it("anota el error de la fuente que falló", async () => {
        fetchAggregator.mockRejectedValue(new Error("503 Service Unavailable"));

        const result = await runJobSearch("profile-1", settings);

        expect(result.bySource).toEqual({ remotive: { fetched: 0, fresh: 0, matchedRole: 0, passed: 0, rejected: 0, error: "503 Service Unavailable" } });
        expect(result.offers).toEqual([]);
    });
});
