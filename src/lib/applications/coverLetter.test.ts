import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
    jobApplication: { findFirst: vi.fn() },
    coverLetter: { count: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    cV: { findFirst: vi.fn() },
    usageLog: { create: vi.fn(), count: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));
const postToMcp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ia/client", () => ({ postToMcp }));
const detectKeywords = vi.hoisted(() => vi.fn());
vi.mock("@/lib/keywords/dictionary", () => ({ detectKeywords }));

import { generateCoverLetterForApplication } from "./coverLetter";

// Diccionario de prueba: lo que detectKeywords reconoce en un texto
const SKILLS = [
    { id: "go", name: "Go", pattern: /\bGo\b/ },
    { id: "react", name: "React", pattern: /React/ },
    { id: "node", name: "Node.js", pattern: /\bNode/ },
    { id: "prisma", name: "Prisma", pattern: /Prisma/ },
];
const fakeDetect = async (text: string) =>
    SKILLS.filter((skill) => skill.pattern.test(text)).map((skill) => ({ id: skill.id, name: skill.name, category: "TECH", count: 1 }));

const CLEAN = "Hola equipo de Acme,\n\n" + "En KeyWords armé el pipeline de keywords con Node y Prisma. ".repeat(4) + "\n\nSergio";
const WITH_TELLS = "Hola equipo de Acme,\n\n" + "I am thrilled to leverage my experience. ".repeat(6) + "\n\nSergio";
const ENGLISH = "Hi Acme team,\n\n" + "In KeyWords I built the keyword pipeline with Node and Prisma for the team. ".repeat(4) + "\n\nSergio";
const CLAIMS_GO = "Hola equipo de Acme,\n\n" + "Tengo experiencia con Go y con Node en el equipo de KeyWords. ".repeat(4) + "\n\nSergio";

const offer = (jobDescription: string) =>
    db.jobApplication.findFirst.mockResolvedValue({
        jobTitle: "Full Stack Developer", company: "Acme", jobDescription, coverLetter: null, cvVariant: null,
        profile: { userId: "user-1", user: { name: "Sergio" } },
    });

beforeEach(() => {
    vi.clearAllMocks();
    offer("React y Node para el equipo de pagos");
    db.coverLetter.count.mockResolvedValue(0);
    db.usageLog.create.mockResolvedValue({ id: "use-1" });
    db.usageLog.count.mockResolvedValue(1);
    db.usageLog.delete.mockResolvedValue({});
    db.coverLetter.findMany.mockResolvedValue([]);
    db.cV.findFirst.mockResolvedValue({ text: "Sergio. Node, React y Prisma en KeyWords." });
    db.coverLetter.upsert.mockResolvedValue({});
    detectKeywords.mockImplementation(fakeDetect);
});

const savedText = () => db.coverLetter.upsert.mock.calls[0][0].create.text;

describe("generateCoverLetterForApplication", () => {
    it("guarda la carta al primer intento si no tiene muletillas", async () => {
        postToMcp.mockResolvedValue({ text: CLEAN, providerId: "groq" });

        const result = await generateCoverLetterForApplication("profile-1", "app-1");

        expect(result).toEqual({ ok: true, data: { text: CLEAN } });
        expect(postToMcp).toHaveBeenCalledTimes(1);
        expect(savedText()).toBe(CLEAN);
    });

    it("reintenta una vez pidiendo evitar las muletillas y guarda la versión limpia", async () => {
        postToMcp.mockResolvedValueOnce({ text: WITH_TELLS, providerId: "groq" }).mockResolvedValueOnce({ text: CLEAN, providerId: "gemini" });

        const result = await generateCoverLetterForApplication("profile-1", "app-1");

        expect(postToMcp).toHaveBeenCalledTimes(2);
        expect(postToMcp.mock.calls[1][0]).toContain("La versión anterior usó: I am thrilled/excited, leverage.");
        expect(result).toEqual({ ok: true, data: { text: CLEAN } });
        expect(savedText()).toBe(CLEAN);
    });

    it("si el reintento no mejora, guarda la primera versión", async () => {
        postToMcp.mockResolvedValue({ text: WITH_TELLS, providerId: "groq" });

        const result = await generateCoverLetterForApplication("profile-1", "app-1");

        expect(result.ok).toBe(true);
        expect(savedText()).toBe(WITH_TELLS);
    });

    it("si el reintento falla, guarda la primera versión", async () => {
        postToMcp.mockResolvedValueOnce({ text: WITH_TELLS, providerId: "groq" }).mockRejectedValueOnce(new Error("timeout"));

        const result = await generateCoverLetterForApplication("profile-1", "app-1");

        expect(result.ok).toBe(true);
        expect(savedText()).toBe(WITH_TELLS);
    });

    it("pide la carta en el idioma de la oferta y usa la carta modelo de ese idioma", async () => {
        offer("We are looking for a developer to join our team and build the tools our customers use.");
        db.coverLetter.findMany.mockResolvedValue([
            { text: "Hola equipo, soy desarrollador y trabajo con React en el Instituto de Ayuda Financiera." },
            { text: "Hi team, I'm a developer and I work with React at the Instituto de Ayuda Financiera." },
        ]);
        postToMcp.mockResolvedValue({ text: ENGLISH, providerId: "groq" });

        await generateCoverLetterForApplication("profile-1", "app-1");

        const prompt = postToMcp.mock.calls[0][0];
        expect(prompt).toContain("Escribila en inglés");
        expect(prompt).toContain("Hi team, I'm a developer");
        expect(prompt).not.toContain("Hola equipo, soy desarrollador");
        expect(postToMcp).toHaveBeenCalledTimes(1);
    });

    it("le dice qué tecnologías de la oferta no están en el CV", async () => {
        offer("Buscamos un desarrollador con Go y React para el equipo de pagos");
        postToMcp.mockResolvedValue({ text: CLEAN, providerId: "groq" });

        await generateCoverLetterForApplication("profile-1", "app-1");

        expect(postToMcp.mock.calls[0][0]).toContain("La oferta pide Go y el CV no los menciona");
    });

    it("si la carta nombra una tecnología que no está en el CV, la pide de nuevo y guarda la corregida", async () => {
        postToMcp.mockResolvedValueOnce({ text: CLAIMS_GO, providerId: "groq" }).mockResolvedValueOnce({ text: CLEAN, providerId: "gemini" });

        const result = await generateCoverLetterForApplication("profile-1", "app-1");

        expect(postToMcp).toHaveBeenCalledTimes(2);
        expect(postToMcp.mock.calls[1][0]).toContain("nombró tecnologías que no están en el CV (Go)");
        expect(result).toEqual({ ok: true, data: { text: CLEAN } });
    });

    it("si la carta sale en otro idioma, la pide de nuevo y guarda la del idioma correcto", async () => {
        offer("We are looking for a developer to join our team and build the tools our customers use.");
        postToMcp.mockResolvedValueOnce({ text: CLEAN, providerId: "groq" }).mockResolvedValueOnce({ text: ENGLISH, providerId: "gemini" });

        const result = await generateCoverLetterForApplication("profile-1", "app-1");

        expect(postToMcp.mock.calls[1][0]).toContain("La versión anterior no estaba en inglés.");
        expect(result).toEqual({ ok: true, data: { text: ENGLISH } });
    });

    it("regenerar la misma carta cuenta para el tope diario: pasado el tope no llama a la IA", async () => {
        // La misma oferta regenerada muchas veces deja una sola fila de carta, pero cada pedido queda registrado
        db.usageLog.count.mockResolvedValue(61);
        postToMcp.mockResolvedValue({ text: CLEAN, providerId: "groq" });

        const result = await generateCoverLetterForApplication("profile-1", "app-1", { overwrite: true });

        expect(result).toMatchObject({ ok: false, code: "LIMIT_REACHED" });
        expect(postToMcp).not.toHaveBeenCalled();
        expect(db.usageLog.create).toHaveBeenCalledWith({ data: { userId: "user-1", action: "GENERATE_COVER_LETTER" }, select: { id: true } });
        // El pedido rechazado no ocupa cupo
        expect(db.usageLog.delete).toHaveBeenCalledWith({ where: { id: "use-1" } });
    });

    it("si la IA no responde, el pedido no cuenta para el tope", async () => {
        postToMcp.mockRejectedValue(new Error("timeout"));

        const result = await generateCoverLetterForApplication("profile-1", "app-1");

        expect(result).toMatchObject({ ok: false, code: "AI_SERVICE_UNAVAILABLE" });
        expect(db.usageLog.delete).toHaveBeenCalledWith({ where: { id: "use-1" } });
    });

    it("una carta generada queda registrada y no se borra", async () => {
        postToMcp.mockResolvedValue({ text: CLEAN, providerId: "groq" });

        await generateCoverLetterForApplication("profile-1", "app-1");

        expect(db.usageLog.create).toHaveBeenCalledTimes(1);
        expect(db.usageLog.delete).not.toHaveBeenCalled();
    });

    it("si no puede leer el diccionario, genera la carta igual", async () => {
        detectKeywords.mockRejectedValue(new Error("db down"));
        postToMcp.mockResolvedValue({ text: CLEAN, providerId: "groq" });

        const result = await generateCoverLetterForApplication("profile-1", "app-1");

        expect(result).toEqual({ ok: true, data: { text: CLEAN } });
        expect(postToMcp).toHaveBeenCalledTimes(1);
    });
});
