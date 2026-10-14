import { describe, expect, it, vi } from "vitest";

// El manager carga el histórico de la base al crearse: acá arranca vacío.
vi.mock("@/lib/prisma", () => ({
  default: { providerStats: { groupBy: vi.fn().mockResolvedValue([]) } },
}));

import { providerManager } from "./providerManager";

describe("providerManager.reportPing", () => {
  it("un ping fallido pausa al proveedor, guarda el error y no toca el score", () => {
    providerManager.reportPing("groq", { ok: false, error: "model not found" });

    const state = providerManager.getStats("groq");
    expect(state.cooldownUntil).toBeGreaterThan(Date.now());
    expect(state.lastError).toBe("model not found");
    expect(state.lastErrorAt).not.toBeNull();
    expect(state.totalErrors).toBe(1);
    expect(state.score).toBe(100);
  });

  it("mientras está pausado el router no lo elige", () => {
    for (let i = 0; i < 20; i++) {
      expect(providerManager.selectProvider(["groq", "gemini"])).toBe("gemini");
    }
  });

  it("un ping exitoso lo vuelve a poner en rotación", () => {
    providerManager.reportPing("groq", { ok: true });

    const state = providerManager.getStats("groq");
    expect(state.cooldownUntil).toBeNull();
    expect(state.lastOkAt).not.toBeNull();
  });
});

describe("providerManager.reportFailure", () => {
  it("guarda el mensaje del error real y penaliza el score", () => {
    providerManager.reportFailure("cerebras", "404 model llama3.1-8b does not exist");

    const state = providerManager.getStats("cerebras");
    expect(state.lastError).toBe("404 model llama3.1-8b does not exist");
    expect(state.cooldownUntil).toBeGreaterThan(Date.now());
    expect(state.score).toBe(70);
  });
});
