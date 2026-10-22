import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
    jobApplication: { findFirst: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    answerTemplate: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    cvVariant: { create: vi.fn() },
    applicationAnswer: { deleteMany: vi.fn(), createMany: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    coverLetter: { upsert: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    cV: { findFirst: vi.fn(), findMany: vi.fn() },
    mediaAsset: { findMany: vi.fn() },
    $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: db }));
const create = vi.hoisted(() => ({ createApplicationForProfile: vi.fn() }));
vi.mock("@/lib/applications/create", () => create);
const positions = vi.hoisted(() => ({ getDesiredRolesForProfile: vi.fn(), saveDesiredRoles: vi.fn() }));
vi.mock("@/lib/positions/save", () => positions);
const search = vi.hoisted(() => ({ runSavedSearch: vi.fn() }));
vi.mock("@/lib/ingest/run", () => search);
const stats = vi.hoisted(() => ({ loadSearchStats: vi.fn() }));
vi.mock("@/lib/stats/searchStatsQuery", () => stats);
const coverLetters = vi.hoisted(() => ({ generateCoverLetterForApplication: vi.fn() }));
vi.mock("@/lib/applications/coverLetter", () => coverLetters);
const skip = vi.hoisted(() => ({ skipApplications: vi.fn() }));
vi.mock("@/lib/applications/skip", () => skip);
const preferences = vi.hoisted(() => ({ listPreferences: vi.fn(), savePreference: vi.fn(), deletePreference: vi.fn() }));
vi.mock("@/lib/preferences/preferences", () => preferences);
const settings = vi.hoisted(() => ({ loadSearchSettings: vi.fn(), updateSearchRules: vi.fn() }));
vi.mock("@/lib/ingest/settings", () => settings);

import { WRITING_GUIDE } from "@/lib/applications/voice";
import { handleMcpMessage } from "./mcp";
import { SERVER_INSTRUCTIONS, agentTools } from "./tools";

const ctx = { userId: "user-1", profileId: "profile-1", tokenId: "token-1" };
const info = { name: "keywords", version: "test", instructions: SERVER_INSTRUCTIONS };

async function callTool(name: string, args: unknown) {
    const response = await handleMcpMessage(
        { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
        ctx,
        agentTools,
        info
    );
    const result = response?.result as { content: { text: string }[]; isError?: boolean };
    return { isError: !!result.isError, text: result.content[0].text };
}

beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
    db.applicationAnswer.groupBy.mockResolvedValue([]);
    db.applicationAnswer.findMany.mockResolvedValue([]);
    skip.skipApplications.mockImplementation(async (_profileId: string, items: { id: string }[]) => ({
        skipped: items.map((item) => item.id),
        learned: [],
    }));
});

describe("agentTools", () => {
    it("publica un schema de entrada para cada herramienta", async () => {
        const response = await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx, agentTools, info);
        const tools = (response?.result as { tools: { name: string; inputSchema: { type: string } }[] }).tools;
        const names = tools.map((tool) => tool.name);
        expect(names).toContain("record_result");
        expect(names).toEqual(
            expect.arrayContaining(["get_preferences", "save_preference", "delete_preference", "set_search_rules", "prepare_cover_letter"])
        );
        for (const tool of tools) expect(tool.inputSchema.type, tool.name).toBe("object");
    });

    it("la cola se puede filtrar por quién envía el formulario", async () => {
        db.jobApplication.findMany.mockResolvedValue([]);

        await callTool("get_queue", { status: "APPROVED", applyMode: "EXTERNAL_FORM" });

        expect(db.jobApplication.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { profileId: "profile-1", status: "APPROVED", applyMode: "EXTERNAL_FORM" } })
        );
    });

    it("add_offer deja como manual una oferta cuyo formulario está en Indeed, aunque el agente diga otra cosa", async () => {
        create.createApplicationForProfile.mockResolvedValue({
            ok: true,
            data: { application: { id: "app-9", status: "READY", applyMode: "UNSUPPORTED", jobTitle: "Dev" } },
        });

        await callTool("add_offer", {
            jobTitle: "Dev",
            jobDescription: "...",
            link: "https://ar.indeed.com/viewjob?jk=1",
            applyUrl: "https://ar.indeed.com/applystart?jk=1",
            applyMode: "EXTERNAL_FORM",
        });
        expect(create.createApplicationForProfile.mock.calls[0][1]).toMatchObject({ applyMode: "UNSUPPORTED", source: "agent" });

        await callTool("add_offer", { jobTitle: "Dev", jobDescription: "...", link: "https://jobs.lever.co/acme/1" });
        expect(create.createApplicationForProfile.mock.calls[1][1]).toMatchObject({ applyMode: "EXTERNAL_FORM" });
    });

    it("record_result suma sus notas a las del ingreso en vez de pisarlas", async () => {
        db.jobApplication.findFirst.mockResolvedValue({ id: "app-1", cvId: null, notes: "Remoto · match 58%" });

        await callTool("record_result", { id: "app-1", status: "APPLIED", notes: "Enviada por Ashby el 20/10/2026" });

        expect(db.jobApplication.update.mock.calls[0][0].data.notes).toBe("Remoto · match 58%\nEnviada por Ashby el 20/10/2026");
    });

    it("record_result con SKIPPED guarda el motivo y devuelve lo aprendido", async () => {
        db.jobApplication.findFirst.mockResolvedValue({ id: "app-1", cvId: null, notes: null });
        skip.skipApplications.mockResolvedValue({ skipped: ["app-1"], learned: [{ kind: "AVOID_TECH", value: "Go" }] });

        const result = JSON.parse((await callTool("record_result", { id: "app-1", status: "SKIPPED", reason: "TECH", detail: "Go" })).text);

        expect(skip.skipApplications).toHaveBeenCalledWith("profile-1", [{ id: "app-1", reason: "TECH", detail: "Go" }], ["SKIPPED"]);
        expect(result.learned).toEqual([{ kind: "AVOID_TECH", value: "Go" }]);
    });

    it("get_preferences junta las reglas de la búsqueda con las preferencias", async () => {
        settings.loadSearchSettings.mockResolvedValue({
            workModes: ["REMOTE"], seniorityPolicy: "FLEXIBLE", minScore: 40, minRelocationSalaryUsd: 2500,
            autoApproveMinScore: 60, minSalaryUsdMonthly: 2500, minSalaryArsMonthly: 3500000, maxPerCompanyPerMonth: 2, exists: true,
        });
        preferences.listPreferences.mockResolvedValue([{ id: "p1", kind: "AVOID_TECH", value: "PHP", origin: "LEARNED", note: null, createdAt: "2026-10-20T00:00:00.000Z" }]);

        const result = JSON.parse((await callTool("get_preferences", {})).text);

        expect(result.rules).toEqual({
            workModes: ["REMOTE"], seniorityPolicy: "FLEXIBLE", minScore: 40, minRelocationSalaryUsd: 2500,
            autoApproveMinScore: 60, minSalaryUsdMonthly: 2500, minSalaryArsMonthly: 3500000, maxPerCompanyPerMonth: 2,
        });
        expect(result.preferences[0]).toMatchObject({ kind: "AVOID_TECH", value: "PHP", origin: "LEARNED" });
    });

    it("save_preference guarda como del usuario y delete_preference avisa si no existe", async () => {
        preferences.savePreference.mockResolvedValue({ ok: true, data: { id: "p1", value: "Go", created: true } });
        await callTool("save_preference", { kind: "AVOID_TECH", value: "Go" });
        expect(preferences.savePreference).toHaveBeenCalledWith("profile-1", { kind: "AVOID_TECH", value: "Go", origin: "USER" });

        preferences.deletePreference.mockResolvedValue(false);
        expect((await callTool("delete_preference", { id: "p-de-otro" })).isError).toBe(true);
    });

    it("set_search_rules guarda solo lo que viene y rechaza valores fuera de rango", async () => {
        settings.updateSearchRules.mockResolvedValue({ autoApproveMinScore: 60, minSalaryUsdMonthly: null, minSalaryArsMonthly: null, maxPerCompanyPerMonth: 2 });

        await callTool("set_search_rules", { autoApproveMinScore: 60 });
        expect(settings.updateSearchRules).toHaveBeenCalledWith("profile-1", { autoApproveMinScore: 60 });

        expect((await callTool("set_search_rules", { autoApproveMinScore: 150 })).isError).toBe(true);
        expect((await callTool("set_search_rules", {})).isError).toBe(true);
    });

    it("prepare_cover_letter devuelve la carta guardada o la genera", async () => {
        db.jobApplication.findFirst.mockResolvedValue({ id: "app-1" });
        db.coverLetter.findUnique.mockResolvedValue({ text: "Hola equipo..." });
        expect(JSON.parse((await callTool("prepare_cover_letter", { id: "app-1" })).text)).toEqual({ text: "Hola equipo...", generated: false });
        expect(coverLetters.generateCoverLetterForApplication).not.toHaveBeenCalled();

        db.coverLetter.findUnique.mockResolvedValue(null);
        coverLetters.generateCoverLetterForApplication.mockResolvedValue({ ok: true, data: { text: "carta nueva" } });
        expect(JSON.parse((await callTool("prepare_cover_letter", { id: "app-1" })).text)).toEqual({ text: "carta nueva", generated: true });
        expect(coverLetters.generateCoverLetterForApplication).toHaveBeenCalledWith("profile-1", "app-1");

        coverLetters.generateCoverLetterForApplication.mockResolvedValue({ ok: false, code: "LIMIT_REACHED", message: "Llegaste al máximo" });
        expect((await callTool("prepare_cover_letter", { id: "app-1" })).isError).toBe(true);
    });

    it("busca las ofertas siempre dentro del perfil del token", async () => {
        db.jobApplication.findFirst.mockResolvedValue(null);

        const result = await callTool("get_application", { id: "app-de-otro" });

        expect(result.isError).toBe(true);
        expect(db.jobApplication.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "app-de-otro", profileId: "profile-1" } }));
        expect(db.jobApplication.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("get_application trae el detalle con una sola consulta, dentro del perfil", async () => {
        db.jobApplication.findFirst.mockResolvedValue({
            id: "app-1", jobTitle: "Dev", company: "Acme", status: "APPROVED", link: "https://acme.com/1", applyUrl: null,
            applyMode: "EXTERNAL_FORM", score: 70, notes: null, jobDescription: "React", coverLetter: null, answers: [], cvVariant: null,
        });

        const result = JSON.parse((await callTool("get_application", { id: "app-1" })).text);

        expect(db.jobApplication.findFirst).toHaveBeenCalledTimes(1);
        expect(db.jobApplication.findUniqueOrThrow).not.toHaveBeenCalled();
        expect(result).toMatchObject({ id: "app-1", applyUrl: "https://acme.com/1", jobDescription: "React", coverLetter: null });
    });

    it("no registra resultados sobre una oferta de otro perfil", async () => {
        db.jobApplication.findFirst.mockResolvedValue(null);

        const result = await callTool("record_result", { id: "app-de-otro", status: "APPLIED" });

        expect(result.isError).toBe(true);
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("la cola filtra por perfil y por defecto trae las aprobadas", async () => {
        db.jobApplication.findMany.mockResolvedValue([]);

        await callTool("get_queue", {});

        expect(db.jobApplication.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { profileId: "profile-1", status: "APPROVED" }, take: 10 })
        );
    });

    it("la cola trae las notas y la fuente, para revisar las ofertas en el chat", async () => {
        db.jobApplication.findMany.mockResolvedValue([]);

        await callTool("get_queue", { status: "READY" });

        expect(db.jobApplication.findMany.mock.calls[0][0].select).toMatchObject({ notes: true, source: true });
    });

    it("registra la postulación enviada con sus respuestas, carta y CV adaptado", async () => {
        db.jobApplication.findFirst.mockResolvedValue({ id: "app-1", cvId: "cv-1" });
        // Solo tpl-1 es del usuario; tpl-ajena se descarta como referencia
        db.answerTemplate.findMany.mockResolvedValue([{ id: "tpl-1" }]);
        db.cvVariant.create.mockResolvedValue({ id: "variant-1" });

        const result = await callTool("record_result", {
            id: "app-1",
            status: "APPLIED",
            answers: [
                { question: "Pretensión salarial", answer: "USD 4000", templateId: "tpl-1" },
                { question: "¿Visa?", answer: "No necesito", templateId: "tpl-ajena" },
            ],
            coverLetter: "Hola equipo...",
            cvVariant: { name: "CV para Acme", text: "texto adaptado" },
        });

        expect(result.isError).toBe(false);
        expect(db.answerTemplate.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: { in: ["tpl-1", "tpl-ajena"] }, profileId: "profile-1" } })
        );
        expect(db.cvVariant.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ profileId: "profile-1", baseCvId: "cv-1" }) })
        );
        const update = db.jobApplication.update.mock.calls[0][0];
        expect(update.data).toMatchObject({ status: "APPLIED", cvVariantId: "variant-1" });
        expect(update.data.appliedAt).toBeInstanceOf(Date);
        expect(db.applicationAnswer.deleteMany).toHaveBeenCalledWith({ where: { applicationId: "app-1" } });
        expect(db.applicationAnswer.createMany.mock.calls[0][0].data.map((a: { templateId: string | null }) => a.templateId)).toEqual([
            "tpl-1",
            null,
        ]);
        expect(db.coverLetter.upsert).toHaveBeenCalled();
    });

    it("una postulación trabada no marca fecha de envío ni toca respuestas que no se mandaron", async () => {
        db.jobApplication.findFirst.mockResolvedValue({ id: "app-1", cvId: null });

        await callTool("record_result", { id: "app-1", status: "NEEDS_USER", notes: "Pide CAPTCHA" });

        const update = db.jobApplication.update.mock.calls[0][0];
        expect(update.data).toEqual({ status: "NEEDS_USER", notes: "Pide CAPTCHA" });
        expect(db.applicationAnswer.deleteMany).not.toHaveBeenCalled();
    });

    it("actualiza la plantilla existente en lugar de duplicarla", async () => {
        db.answerTemplate.findFirst.mockResolvedValue({ id: "tpl-1" });
        db.answerTemplate.update.mockResolvedValue({ id: "tpl-1" });

        const result = await callTool("save_answer_template", { question: "pretensión salarial", answer: "USD 4500", tags: ["Salary", "salary"] });

        expect(JSON.parse(result.text)).toEqual({ id: "tpl-1", updated: true });
        expect(db.answerTemplate.update.mock.calls[0][0].data.tags).toEqual(["salary"]);
        expect(db.answerTemplate.create).not.toHaveBeenCalled();
    });

    it("muestra los puestos deseados del perfil del token y los que se pueden elegir", async () => {
        positions.getDesiredRolesForProfile.mockResolvedValue({
            selected: ["Full Stack Developer"],
            unrecognized: [],
            available: ["Backend Developer", "Full Stack Developer"],
        });

        const result = await callTool("get_desired_positions", {});

        expect(positions.getDesiredRolesForProfile).toHaveBeenCalledWith("profile-1");
        expect(JSON.parse(result.text)).toEqual({ selected: ["Full Stack Developer"], available: ["Backend Developer", "Full Stack Developer"] });
    });

    it("guarda los puestos deseados en el perfil del token y avisa cuáles no reconoce", async () => {
        positions.saveDesiredRoles.mockResolvedValue({ ok: true, data: { roles: ["Backend Developer"], dropped: ["Astronauta"] } });

        const result = await callTool("set_desired_positions", { titles: ["Backend Developer", "Astronauta"] });

        expect(positions.saveDesiredRoles).toHaveBeenCalledWith("profile-1", ["Backend Developer", "Astronauta"]);
        expect(JSON.parse(result.text)).toEqual({ saved: ["Backend Developer"], notRecognized: ["Astronauta"] });
    });

    it("devuelve como error un guardado de puestos inválido", async () => {
        positions.saveDesiredRoles.mockResolvedValue({ ok: false, code: "INVALID_INPUT", message: "Máximo 10 puestos." });

        const result = await callTool("set_desired_positions", { titles: ["Backend Developer"] });

        expect(result).toEqual({ isError: true, text: "Máximo 10 puestos." });
    });

    it("busca ofertas nuevas con la configuración guardada del perfil del token", async () => {
        search.runSavedSearch.mockResolvedValue({ ok: true, data: { summary: "300 ofertas revisadas, 20 nuevas en la cola.", created: 20 } });

        const result = await callTool("search_now", {});

        expect(search.runSavedSearch).toHaveBeenCalledWith("profile-1", "AGENT");
        expect(JSON.parse(result.text)).toEqual({ summary: "300 ofertas revisadas, 20 nuevas en la cola.", created: 20 });
    });

    it("avisa como error si se buscó hace poco", async () => {
        search.runSavedSearch.mockResolvedValue({ ok: false, code: "TOO_SOON", message: "Ya se buscó hace poco. Podés volver a buscar en 30 min." });

        const result = await callTool("search_now", {});

        expect(result).toEqual({ isError: true, text: "Ya se buscó hace poco. Podés volver a buscar en 30 min." });
    });

    it("get_search_stats consulta el perfil del token con el período pedido", async () => {
        stats.loadSearchStats.mockResolvedValue({ days: 7, funnel: {}, sources: [] });

        const result = await callTool("get_search_stats", { days: 7 });

        expect(result.isError).toBe(false);
        expect(stats.loadSearchStats).toHaveBeenCalledWith("profile-1", 7);
    });

    it("get_search_stats usa 30 días por defecto y rechaza otros períodos", async () => {
        stats.loadSearchStats.mockResolvedValue({});
        await callTool("get_search_stats", {});
        expect(stats.loadSearchStats).toHaveBeenCalledWith("profile-1", 30);

        expect((await callTool("get_search_stats", { days: 15 })).isError).toBe(true);
    });

    it("aprueba y descarta ofertas del perfil del token sin generar cartas", async () => {
        db.jobApplication.findMany.mockResolvedValue([
            { id: "app-1", status: "READY" },
            { id: "app-2", status: "READY" },
        ]);

        const result = await callTool("review_offers", { approve: ["app-1", "app-otro-perfil"], skip: ["app-2"] });

        expect(db.jobApplication.findMany).toHaveBeenCalledWith({
            where: { id: { in: ["app-1", "app-otro-perfil", "app-2"] }, profileId: "profile-1", status: { in: ["READY", "APPROVED", "NEEDS_USER"] } },
            select: { id: true, status: true },
        });
        expect(db.jobApplication.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["app-1"] }, profileId: "profile-1" }, data: { status: "APPROVED" } });
        expect(skip.skipApplications).toHaveBeenCalledWith("profile-1", [{ id: "app-2" }], ["READY", "APPROVED", "NEEDS_USER"]);
        // La carta se genera cuando el formulario la pide (prepare_cover_letter), no al aprobar
        expect(coverLetters.generateCoverLetterForApplication).not.toHaveBeenCalled();
        expect(JSON.parse(result.text)).toEqual({ approved: 1, skipped: 1, learned: [], notFound: ["app-otro-perfil"] });
    });

    it("los descartes con motivo aprenden y lo cuentan", async () => {
        db.jobApplication.findMany.mockResolvedValue([
            { id: "app-2", status: "READY" },
            { id: "app-3", status: "APPROVED" },
        ]);
        skip.skipApplications.mockResolvedValue({ skipped: ["app-2", "app-3"], learned: [{ kind: "AVOID_TECH", value: "PHP" }] });

        const result = await callTool("review_offers", {
            skip: [{ id: "app-2", reason: "TECH", detail: "PHP" }, { id: "app-3", reason: "LANGUAGE", detail: "alemán" }, "app-ajena"],
        });

        expect(skip.skipApplications).toHaveBeenCalledWith(
            "profile-1",
            [{ id: "app-2", reason: "TECH", detail: "PHP" }, { id: "app-3", reason: "LANGUAGE", detail: "alemán" }],
            ["READY", "APPROVED", "NEEDS_USER"]
        );
        expect(JSON.parse(result.text)).toEqual({ approved: 0, skipped: 2, learned: [{ kind: "AVOID_TECH", value: "PHP" }], notFound: ["app-ajena"] });
    });

    it("una oferta aprobada y descartada a la vez solo se aprueba", async () => {
        db.jobApplication.findMany.mockResolvedValue([{ id: "app-1", status: "READY" }]);

        await callTool("review_offers", { approve: ["app-1"], skip: [{ id: "app-1", reason: "OTHER" }] });

        expect(skip.skipApplications).not.toHaveBeenCalled();
    });

    it("pide al menos una oferta para revisar", async () => {
        const result = await callTool("review_offers", {});

        expect(result.isError).toBe(true);
        expect(db.jobApplication.updateMany).not.toHaveBeenCalled();
    });

    it("guarda el link del formulario donde se postuló, para sugerir seguir esa empresa", async () => {
        db.jobApplication.findFirst.mockResolvedValue({ id: "app-1", cvId: null });

        await callTool("record_result", { id: "app-1", status: "APPLIED", formUrl: "https://jobs.lever.co/webfx/123/apply" });

        expect(db.jobApplication.update.mock.calls[0][0].data.applyUrl).toBe("https://jobs.lever.co/webfx/123/apply");
    });

    it("no guarda un link de formulario que no es http(s)", async () => {
        db.jobApplication.findFirst.mockResolvedValue({ id: "app-1", cvId: null });

        const result = await callTool("record_result", { id: "app-1", status: "APPLIED", formUrl: "javascript:alert(1)" });

        expect(result.isError).toBe(true);
        expect(db.jobApplication.update).not.toHaveBeenCalled();
    });

    it("get_candidate devuelve el archivo de cada CV con su idioma, para subir el que corresponde", async () => {
        db.user.findUnique.mockResolvedValue({ name: "Sergio", email: "s@example.com" });
        db.cV.findFirst.mockResolvedValue({ id: "cv-en", name: "CV EN", text: "..." });
        db.cV.findMany.mockResolvedValue([
            { name: "CV EN", isPrimary: true, language: "en", fileUrl: "https://example.com/en.pdf", filePath: "G:/cv/en.pdf" },
            { name: "CV ES", isPrimary: false, language: "es", fileUrl: null, filePath: "G:/cv/es.pdf" },
        ]);
        db.mediaAsset.findMany.mockResolvedValue([]);
        db.coverLetter.findMany.mockResolvedValue([]);

        const result = JSON.parse((await callTool("get_candidate", {})).text);

        expect(db.cV.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { profileId: "profile-1" } }));
        expect(result.cvFiles).toEqual([
            { name: "CV EN", isPrimary: true, language: "en", fileUrl: "https://example.com/en.pdf", filePath: "G:/cv/en.pdf" },
            { name: "CV ES", isPrimary: false, language: "es", fileUrl: null, filePath: "G:/cv/es.pdf" },
        ]);
    });

    it("list_answer_templates dice el modo, cuántas veces se usó y la última adaptación", async () => {
        db.answerTemplate.findMany.mockResolvedValue([{ id: "t1", question: "¿Por qué acá?", answer: "Me interesa...", tags: ["motivation"], language: null, mode: "ADAPT" }]);
        db.applicationAnswer.groupBy.mockResolvedValue([{ templateId: "t1", _count: { _all: 3 } }]);
        db.applicationAnswer.findMany.mockResolvedValue([{ templateId: "t1", answer: "Vi que trabajan con Next..." }]);

        const result = JSON.parse((await callTool("list_answer_templates", {})).text);

        expect(result.templates[0]).toMatchObject({ mode: "ADAPT", usedCount: 3, lastAdapted: "Vi que trabajan con Next..." });
    });

    it("la última adaptación saltea las opciones elegidas de un desplegable", async () => {
        db.answerTemplate.findMany.mockResolvedValue([
            { id: "salario", question: "Pretensión salarial", answer: "2500 USD", tags: [], language: null, mode: "VERBATIM" },
            { id: "motivo", question: "¿Por qué acá?", answer: "Me interesa...", tags: [], language: null, mode: "ADAPT" },
        ]);
        db.applicationAnswer.findMany.mockResolvedValue([
            { templateId: "salario", answer: "$25,000 - $30,000" },
            { templateId: "motivo", answer: "Yes" },
            { templateId: "motivo", answer: "Vi que el producto resuelve algo que uso todos los días." },
        ]);

        const result = JSON.parse((await callTool("list_answer_templates", {})).text);

        expect(result.templates.find((t: { id: string }) => t.id === "salario").lastAdapted).toBeNull();
        expect(result.templates.find((t: { id: string }) => t.id === "motivo").lastAdapted).toBe("Vi que el producto resuelve algo que uso todos los días.");
    });

    it("save_answer_template guarda el modo y no lo toca al actualizar si no viene", async () => {
        db.answerTemplate.findFirst.mockResolvedValue(null);
        db.answerTemplate.count.mockResolvedValue(0);
        db.answerTemplate.create.mockResolvedValue({ id: "t2" });
        await callTool("save_answer_template", { question: "Un proyecto", answer: "KeyWords...", mode: "ADAPT" });
        expect(db.answerTemplate.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mode: "ADAPT" }) }));

        db.answerTemplate.findFirst.mockResolvedValue({ id: "t2" });
        db.answerTemplate.update.mockResolvedValue({ id: "t2" });
        await callTool("save_answer_template", { question: "Un proyecto", answer: "KeyWords v2..." });
        expect(db.answerTemplate.update.mock.calls[0][0].data).not.toHaveProperty("mode");
    });

    it("record_result guarda de dónde salió cada respuesta", async () => {
        db.jobApplication.findFirst.mockResolvedValue({ id: "app-1", cvId: null });
        db.answerTemplate.findMany.mockResolvedValue([]);

        await callTool("record_result", {
            id: "app-1", status: "APPLIED",
            answers: [{ question: "Sueldo", answer: "2500 USD", origin: "TEMPLATE" }, { question: "GitHub", answer: "github.com/x" }],
        });

        expect(db.applicationAnswer.createMany.mock.calls[0][0].data.map((a: { origin: string | null }) => a.origin)).toEqual(["TEMPLATE", null]);
    });

    it("get_candidate entrega la guía de redacción", async () => {
        db.user.findUnique.mockResolvedValue({ name: "Sergio", email: "s@example.com" });
        db.cV.findFirst.mockResolvedValue(null);
        db.cV.findMany.mockResolvedValue([]);
        db.mediaAsset.findMany.mockResolvedValue([]);
        db.coverLetter.findMany.mockResolvedValue([]);

        const result = JSON.parse((await callTool("get_candidate", {})).text);

        expect(result.writingGuide).toBe(WRITING_GUIDE);
    });
});
