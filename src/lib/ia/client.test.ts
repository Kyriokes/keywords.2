import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({ getAiProvider: vi.fn() }));
vi.mock("./providers/factory", () => providers);
const manager = vi.hoisted(() => ({ providerManager: { logGeneration: vi.fn(), reportFailure: vi.fn() } }));
vi.mock("./providerManager", () => manager);

import { PROVIDER_TIMEOUT_MS, postToMcp } from "./client";

const provider = (id: string, generate: () => Promise<string>) => ({ id, name: id, generate, checkHealth: vi.fn() });
const never = () => new Promise<string>(() => {});

beforeEach(() => {
    providers.getAiProvider.mockReset();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("postToMcp", () => {
    it("si un proveedor no responde a tiempo, lo pausa y prueba con otro", async () => {
        providers.getAiProvider
            .mockReturnValueOnce(provider("groq", never))
            .mockReturnValueOnce(provider("gemini", async () => "listo"));

        const pending = postToMcp("prompt");
        await vi.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS + 1);

        await expect(pending).resolves.toEqual({ text: "listo", providerId: "gemini" });
        expect(manager.providerManager.reportFailure).toHaveBeenCalledWith("groq", expect.stringContaining("no respondió"));
        expect(providers.getAiProvider).toHaveBeenLastCalledWith(["groq"]);
    });

    it("si ninguno responde, termina con error en vez de quedarse esperando", async () => {
        providers.getAiProvider.mockImplementation((exclude: string[]) => provider(`p${exclude.length}`, never));

        const pending = postToMcp("prompt");
        const outcome = expect(pending).rejects.toThrow();
        await vi.advanceTimersByTimeAsync(10 * PROVIDER_TIMEOUT_MS);

        await outcome;
    });
});
