import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
    jobApplication: { findFirst: vi.fn() },
    coverLetter: { count: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    cV: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));
const postToMcp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ia/client", () => ({ postToMcp }));

import { generateCoverLetterForApplication } from "./coverLetter";

const CLEAN = "Hola equipo de Acme,\n\n" + "En KeyWords armé el pipeline de keywords con Node y Prisma. ".repeat(4) + "\n\nSergio";
const WITH_TELLS = "Hola equipo de Acme,\n\n" + "I am thrilled to leverage my experience. ".repeat(6) + "\n\nSergio";

beforeEach(() => {
    vi.clearAllMocks();
    db.jobApplication.findFirst.mockResolvedValue({
        jobTitle: "Full Stack Developer", company: "Acme", jobDescription: "React y Node", coverLetter: null, cvVariant: null,
        profile: { user: { name: "Sergio" } },
    });
    db.coverLetter.count.mockResolvedValue(0);
    db.coverLetter.findFirst.mockResolvedValue(null);
    db.cV.findFirst.mockResolvedValue({ text: "Sergio. Node, React y Prisma en KeyWords." });
    db.coverLetter.upsert.mockResolvedValue({});
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
});
