import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
    position: { findMany: vi.fn() },
    cV: { findFirst: vi.fn() },
    jobApplication: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    cVKeyword: { findMany: vi.fn() },
    jobSearchSettings: { update: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
}));
const create = vi.hoisted(() => vi.fn());
const fetchAggregator = vi.hoisted(() => vi.fn());
const fetchAtsBoard = vi.hoisted(() => vi.fn());
const record = vi.hoisted(() => ({ saveSearchRun: vi.fn() }));
const preferences = vi.hoisted(() => ({ loadPreferenceRules: vi.fn() }));
const skip = vi.hoisted(() => ({ skipApplications: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("@/lib/applications/create", () => ({ createApplicationForProfile: create }));
vi.mock("@/lib/preferences/preferences", () => preferences);
vi.mock("@/lib/applications/skip", () => skip);
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
vi.mock("./sources", async (importOriginal) => ({ ...(await importOriginal<typeof import("./sources")>()), fetchAggregator, fetchAtsBoard }));
vi.mock("./record", () => record);

import { runAndRecord, runJobSearch, runSavedSearch, type SearchSettingsInput } from "./run";

const NO_PREFERENCES = { avoidTechNames: [], avoidTechKeywordIds: new Set<string>(), avoidCompanyKeys: new Set<string>(), avoidPhrases: [] };

const settings: SearchSettingsInput = {
    sources: ["remotive"],
    atsBoards: [],
    minScore: 40,
    maxPerRun: 10,
    workModes: ["REMOTE", "REMOTE_US_HOURS", "HYBRID"],
    seniorityPolicy: "FLEXIBLE",
    minRelocationSalaryUsd: null,
};

// Cada oferta es de otra empresa: la misma empresa con el mismo título contaría como repetida
const job = (id: string, fields: Record<string, unknown>) => ({
    source: "remotive",
    externalId: id,
    title: "Full Stack Developer",
    company: `Acme ${id}`,
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
    create.mockImplementation(async (_profileId: string, input: { externalId: string }) => ({ ok: true, data: { application: { id: `app-${input.externalId}` } } }));
    preferences.loadPreferenceRules.mockResolvedValue(NO_PREFERENCES);
    skip.skipApplications.mockImplementation(async (_profileId: string, items: { id: string }[]) => ({ skipped: items.map((item) => item.id), learned: [] }));
    record.saveSearchRun.mockResolvedValue(undefined);
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
        expect(result.offers[0]).toMatchObject({ source: "remotive", board: null, company: "Acme 1", roleName: "Full Stack Developer", score: 100 });
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

    it("aprueba solas las de match alto sin advertencias y con formulario que Claude puede completar", async () => {
        const result = await runJobSearch("profile-1", { ...settings, autoApproveMinScore: 60 });

        // La 1 es remota, match 100 y formulario externo; la 4 está en Workday
        expect(create).toHaveBeenCalledWith("profile-1", expect.objectContaining({ externalId: "remotive:1", status: "APPROVED" }));
        expect(create).toHaveBeenCalledWith("profile-1", expect.objectContaining({ externalId: "remotive:4", status: "READY" }));
        expect(result.autoApproved).toBe(1);
        expect(result.decisions[0]).toMatchObject({ status: "QUEUED", autoApproved: true });
        expect(result.summary).toBe("4 ofertas revisadas, 4 de tus puestos, 2 descartadas por los filtros, 2 nuevas en la cola (1 aprobada sola).");
    });

    it("una advertencia frena la aprobación automática", async () => {
        fetchAggregator.mockResolvedValue([job("8", { description: "REACT NODE. Remote, est business hours required." })]);

        await runJobSearch("profile-1", { ...settings, autoApproveMinScore: 60 });

        expect(create).toHaveBeenCalledWith("profile-1", expect.objectContaining({ externalId: "remotive:8", status: "READY" }));
    });

    it("las notas dicen cuándo se publicó, qué falta y las advertencias", async () => {
        const now = new Date("2026-10-20T15:00:00.000Z");
        fetchAggregator.mockResolvedValue([
            job("9", { description: "REACT NODE GO KAFKA. Remote, est business hours required.", publishedAt: "2026-10-19T08:00:00.000Z" }),
        ]);

        await runJobSearch("profile-1", settings, new Map(), { now });

        expect(create).toHaveBeenCalledWith(
            "profile-1",
            expect.objectContaining({ notes: "Remoto, horario de EE.UU. · publicada ayer · match 50% · falta: GO, KAFKA · horario de EE.UU." })
        );
    });

    it("descarta las que en los requisitos piden un stack que no está en el CV", async () => {
        fetchAggregator.mockResolvedValue([
            job("10", { description: "We love REACT. Requirements: GO KAFKA and more." }),
            job("11", { description: "We love NODE. Requirements: REACT GO." }),
        ]);

        const result = await runJobSearch("profile-1", settings, new Map(), { dryRun: true });

        expect(result.decisions.map((decision) => [decision.externalId, decision.status, decision.reason])).toEqual([
            ["remotive:10", "REJECTED", "Los requisitos piden GO, KAFKA"],
            ["remotive:11", "PASSES", null],
        ]);
    });

    it("respeta las preferencias: empresas y tecnologías a evitar", async () => {
        preferences.loadPreferenceRules.mockResolvedValue({
            ...NO_PREFERENCES,
            avoidCompanyKeys: new Set(["acme 12"]),
            avoidTechKeywordIds: new Set(["php"]),
        });
        fetchAggregator.mockResolvedValue([job("12", {}), job("13", { description: "REACT NODE. Requirements: REACT PHP." })]);

        const result = await runJobSearch("profile-1", settings, new Map(), { dryRun: true });

        expect(result.decisions.map((decision) => [decision.externalId, decision.reason])).toEqual([
            ["remotive:12", "Evitás Acme 12"],
            ["remotive:13", "Evitás PHP"],
        ]);
    });

    it("no deja entrar más ofertas de una empresa que las que admite el tope mensual", async () => {
        const recent = (id: string, status: string) => ({
            id, source: "himalayas", status, applyUrl: null, company: "Acme 1", jobTitle: "Backend Engineer", date: new Date(),
        });
        db.jobApplication.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([recent("a", "APPROVED"), recent("b", "APPLIED"), recent("c", "SKIPPED")]);

        const result = await runJobSearch("profile-1", { ...settings, maxPerCompanyPerMonth: 2 }, new Map(), { dryRun: true });

        expect(result.decisions[0]).toMatchObject({ externalId: "remotive:1", status: "REJECTED", reason: "Ya tenés 2 ofertas de Acme 1 este mes" });
    });

    it("la misma búsqueda que ya llegó por otro portal no se repite, y toma el formulario directo del ATS", async () => {
        db.jobApplication.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { id: "app-h", source: "himalayas", status: "APPROVED", applyUrl: null, company: "Acme 1", jobTitle: "Full Stack Developer", date: new Date() },
            ]);
        db.jobApplication.findUnique.mockResolvedValue({ notes: "Remoto · match 50%" });
        fetchAggregator.mockResolvedValue([
            job("1", { source: "greenhouse", externalId: "acme:7", url: "https://boards.greenhouse.io/acme/jobs/7", applyUrl: "https://boards.greenhouse.io/acme/jobs/7#app" }),
        ]);

        const result = await runJobSearch("profile-1", settings);

        expect(create).not.toHaveBeenCalled();
        expect(result.offers[0]).toMatchObject({ decision: "IN_ACCOUNT", reason: "Repetida: ya está desde Himalayas (remoto)" });
        expect(db.jobApplication.update).toHaveBeenCalledWith({
            where: { id: "app-h" },
            data: { applyUrl: "https://boards.greenhouse.io/acme/jobs/7#app", notes: "Remoto · match 50%\nFormulario directo encontrado en Greenhouse" },
        });
        expect(result.enriched).toBe(1);
        expect(result.fresh).toBe(0);
    });

    it("dentro de una misma búsqueda, la segunda copia de una oferta cuenta como repetida", async () => {
        fetchAggregator.mockResolvedValue([job("1", {}), job("2", { company: "Acme 1", url: "https://remotive.com/2b" })]);

        const result = await runJobSearch("profile-1", settings);

        expect(create).toHaveBeenCalledTimes(1);
        expect(result.offers[1]).toMatchObject({ decision: "IN_ACCOUNT", reason: "Repetida: ya está desde Remotive (remoto)" });
    });

    it("descarta como cerradas las ofertas de un ATS que respondió y ya no las publica", async () => {
        fetchAggregator.mockResolvedValue([]);
        fetchAtsBoard.mockResolvedValue([job("acme:1", { source: "greenhouse", url: "https://boards.greenhouse.io/acme/jobs/1" })]);
        db.jobApplication.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { id: "app-open", externalId: "greenhouse:acme:1" },
                { id: "app-gone", externalId: "greenhouse:acme:999" },
            ]);

        const result = await runJobSearch("profile-1", { ...settings, atsBoards: ["greenhouse:acme"] });

        expect(skip.skipApplications).toHaveBeenCalledWith(
            "profile-1",
            [{ id: "app-gone", reason: "CLOSED", detail: "Ya no está publicada en Greenhouse" }],
            ["READY", "APPROVED"]
        );
        expect(result.closed).toBe(1);
        expect(result.summary).toContain("1 oferta que seguías ya no está publicada y se descartó.");
    });

    it("si el ATS falló, no da por cerrada ninguna oferta", async () => {
        fetchAggregator.mockResolvedValue([]);
        fetchAtsBoard.mockRejectedValue(new Error("500"));

        const result = await runJobSearch("profile-1", { ...settings, atsBoards: ["greenhouse:acme"] });

        expect(skip.skipApplications).not.toHaveBeenCalled();
        expect(result.closed).toBe(0);
    });
});

describe("runAndRecord", () => {
    it("guarda la corrida con quién la disparó", async () => {
        await runAndRecord("profile-1", settings, new Map(), "MANUAL");

        expect(db.jobSearchSettings.update).toHaveBeenCalled();
        expect(record.saveSearchRun).toHaveBeenCalledWith("profile-1", "MANUAL", expect.objectContaining({ created: 2 }), expect.any(Number));
    });

    it("si las estadísticas fallan, la búsqueda igual termina bien", async () => {
        record.saveSearchRun.mockRejectedValue(new Error("db down"));

        await expect(runAndRecord("profile-1", settings)).resolves.toMatchObject({ created: 2 });
        expect(db.jobSearchSettings.update).toHaveBeenCalled();
    });
});

describe("runSavedSearch", () => {
    beforeEach(() => {
        db.jobSearchSettings.findUnique.mockResolvedValue({ ...settings, profileId: "profile-1", lastRunAt: null });
    });

    it("si llegan dos pedidos juntos, busca uno solo", async () => {
        // La base deja reservar la corrida a uno solo: el segundo encuentra la hora ya tomada
        db.jobSearchSettings.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

        const [first, second] = await Promise.all([runSavedSearch("profile-1", "AGENT"), runSavedSearch("profile-1", "AGENT")]);

        expect(fetchAggregator).toHaveBeenCalledTimes(1);
        expect([first.ok, second.ok].sort()).toEqual([false, true]);
        expect([first, second].find((result) => !result.ok)).toMatchObject({ code: "TOO_SOON" });
    });

    it("reserva la corrida solo si la última fue hace más de una hora", async () => {
        db.jobSearchSettings.updateMany.mockResolvedValue({ count: 1 });

        await runSavedSearch("profile-1", "MANUAL");

        const [{ where }] = db.jobSearchSettings.updateMany.mock.calls[0];
        expect(where.profileId).toBe("profile-1");
        expect(where.OR).toEqual([{ lastRunAt: null }, { lastRunAt: { lt: expect.any(Date) } }]);
        expect(Date.now() - where.OR[1].lastRunAt.lt.getTime()).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    });

    it("si la búsqueda se rompe, devuelve la reserva para poder reintentar", async () => {
        const lastRunAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
        db.jobSearchSettings.findUnique.mockResolvedValue({ ...settings, profileId: "profile-1", lastRunAt });
        db.jobSearchSettings.updateMany.mockResolvedValue({ count: 1 });
        db.position.findMany.mockRejectedValue(new Error("db down"));

        await expect(runSavedSearch("profile-1", "MANUAL")).rejects.toThrow("db down");

        expect(db.jobSearchSettings.updateMany).toHaveBeenLastCalledWith({ where: { profileId: "profile-1" }, data: { lastRunAt } });
    });
});
