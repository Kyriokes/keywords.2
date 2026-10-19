import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
    jobApplication: { findFirst: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    answerTemplate: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    cvVariant: { create: vi.fn() },
    applicationAnswer: { deleteMany: vi.fn(), createMany: vi.fn() },
    coverLetter: { upsert: vi.fn() },
    $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("@/lib/applications/create", () => ({ createApplicationForProfile: vi.fn() }));
const positions = vi.hoisted(() => ({ getDesiredRolesForProfile: vi.fn(), saveDesiredRoles: vi.fn() }));
vi.mock("@/lib/positions/save", () => positions);
const search = vi.hoisted(() => ({ runSavedSearch: vi.fn() }));
vi.mock("@/lib/ingest/run", () => search);

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
});

describe("agentTools", () => {
    it("publica un schema de entrada para cada herramienta", async () => {
        const response = await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx, agentTools, info);
        const tools = (response?.result as { tools: { name: string; inputSchema: { type: string } }[] }).tools;
        expect(tools.map((tool) => tool.name)).toContain("record_result");
        for (const tool of tools) expect(tool.inputSchema.type, tool.name).toBe("object");
    });

    it("busca las ofertas siempre dentro del perfil del token", async () => {
        db.jobApplication.findFirst.mockResolvedValue(null);

        const result = await callTool("get_application", { id: "app-de-otro" });

        expect(result.isError).toBe(true);
        expect(db.jobApplication.findFirst).toHaveBeenCalledWith({ where: { id: "app-de-otro", profileId: "profile-1" } });
        expect(db.jobApplication.findUniqueOrThrow).not.toHaveBeenCalled();
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

        expect(search.runSavedSearch).toHaveBeenCalledWith("profile-1");
        expect(JSON.parse(result.text)).toEqual({ summary: "300 ofertas revisadas, 20 nuevas en la cola.", created: 20 });
    });

    it("avisa como error si se buscó hace poco", async () => {
        search.runSavedSearch.mockResolvedValue({ ok: false, code: "TOO_SOON", message: "Ya se buscó hace poco. Podés volver a buscar en 30 min." });

        const result = await callTool("search_now", {});

        expect(result).toEqual({ isError: true, text: "Ya se buscó hace poco. Podés volver a buscar en 30 min." });
    });
});
