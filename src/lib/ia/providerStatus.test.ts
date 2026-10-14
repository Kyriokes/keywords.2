import { describe, expect, it } from "vitest";
import { formatDuration, getProviderStatus, type ProviderSnapshot } from "./providerStatus";

const NOW = 1_000_000_000;

function snapshot(overrides: Partial<ProviderSnapshot> = {}): ProviderSnapshot {
  return {
    configured: true,
    score: 100,
    cooldownUntil: null,
    totalGenerated: 0,
    totalAccepted: 0,
    totalRejected: 0,
    totalErrors: 0,
    lastOkAt: null,
    lastError: null,
    lastErrorAt: null,
    ...overrides,
  };
}

describe("getProviderStatus", () => {
  it("sin key no está en rotación, aunque tenga historial", () => {
    expect(getProviderStatus(snapshot({ configured: false, lastOkAt: NOW - 1000 }), NOW)).toEqual({ kind: "unconfigured" });
  });

  it("en pausa muestra cuánto falta y el error que la causó", () => {
    const status = getProviderStatus(
      snapshot({ cooldownUntil: NOW + 60_000, lastError: "model not found", lastErrorAt: NOW - 1000 }),
      NOW
    );
    expect(status).toEqual({ kind: "paused", remainingMs: 60_000, error: "model not found" });
  });

  it("si la pausa venció pero lo último fue un error, no lo da por sano", () => {
    const status = getProviderStatus(
      snapshot({ cooldownUntil: NOW - 1, lastOkAt: NOW - 600_000, lastError: "429", lastErrorAt: NOW - 400_000 }),
      NOW
    );
    expect(status).toEqual({ kind: "failing", at: NOW - 400_000, error: "429" });
  });

  it("un éxito posterior al último error lo marca OK", () => {
    const status = getProviderStatus(
      snapshot({ lastOkAt: NOW - 1000, lastError: "429", lastErrorAt: NOW - 5000 }),
      NOW
    );
    expect(status).toEqual({ kind: "ok", at: NOW - 1000 });
  });

  it("sin pings ni generaciones queda sin verificar", () => {
    expect(getProviderStatus(snapshot(), NOW)).toEqual({ kind: "unknown" });
  });
});

describe("formatDuration", () => {
  it("usa segundos, minutos u horas según el tamaño", () => {
    expect(formatDuration(200)).toBe("1 s");
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(4 * 60_000 + 20_000)).toBe("4 min");
    expect(formatDuration(3 * 3_600_000)).toBe("3 h");
  });
});
