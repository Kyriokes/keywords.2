import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isRateLimited, trackedKeys } from "./rateLimit";

afterEach(() => {
    vi.useRealTimers();
});

describe("isRateLimited", () => {
    it("deja pasar hasta el máximo dentro de la ventana", () => {
        expect(isRateLimited("a", 2, 60_000)).toBe(false);
        expect(isRateLimited("a", 2, 60_000)).toBe(false);
        expect(isRateLimited("a", 2, 60_000)).toBe(true);
    });

    it("un pedido puede costar varios lugares: un lote de diez mensajes cuenta como diez", () => {
        expect(isRateLimited("lote", 12, 60_000, 10)).toBe(false);
        expect(isRateLimited("lote", 12, 60_000, 3)).toBe(true);
        expect(isRateLimited("lote", 12, 60_000, 2)).toBe(false);
    });

    it("olvida las claves que ya no tienen pedidos recientes", () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        for (let i = 0; i < 50; i++) isRateLimited(`viejo-${i}`, 5, 1_000);

        vi.setSystemTime(10 * 60_000);
        isRateLimited("nuevo", 5, 1_000);

        expect(trackedKeys().filter((key) => key.startsWith("viejo-"))).toEqual([]);
    });
});
