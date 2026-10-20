import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const generate = vi.hoisted(() => vi.fn());
vi.mock("./coverLetter", () => ({ generateCoverLetterForApplication: generate }));

import { prepareCoverLetters } from "./coverLetterBatch";

beforeEach(() => {
    vi.clearAllMocks();
    generate.mockResolvedValue({ ok: true, data: { text: "carta" } });
});

describe("prepareCoverLetters", () => {
    it("prepara la carta de cada oferta, de a una, sin pisar las que ya existen", async () => {
        const result = await prepareCoverLetters("profile-1", ["a", "b", "c"]);

        expect(generate.mock.calls).toEqual([
            ["profile-1", "a"],
            ["profile-1", "b"],
            ["profile-1", "c"],
        ]);
        expect(result).toEqual({ prepared: 3, pending: 0 });
    });

    it("sigue con las demás si una falla", async () => {
        generate.mockResolvedValueOnce({ ok: false, code: "AI_INVALID", message: "x" });

        expect(await prepareCoverLetters("profile-1", ["a", "b"])).toEqual({ prepared: 1, pending: 1 });
    });

    it("frena al llegar al límite diario de cartas", async () => {
        generate.mockResolvedValueOnce({ ok: true, data: { text: "carta" } }).mockResolvedValueOnce({ ok: false, code: "LIMIT_REACHED", message: "x" });

        const result = await prepareCoverLetters("profile-1", ["a", "b", "c", "d"]);

        expect(generate).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ prepared: 1, pending: 3 });
    });

    it("frena cuando se acaba el tiempo de la función", async () => {
        let now = 0;
        vi.spyOn(Date, "now").mockImplementation(() => now);
        generate.mockImplementation(async () => {
            now += 60_000;
            return { ok: true, data: { text: "carta" } };
        });

        const result = await prepareCoverLetters("profile-1", ["a", "b", "c", "d", "e"], 120_000);

        expect(result).toEqual({ prepared: 2, pending: 3 });
        vi.restoreAllMocks();
    });
});
