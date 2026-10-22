import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
    keywordAlias: { findMany: vi.fn() },
    canonicalPosition: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));

import { getDictionary, invalidateDictionary } from "./dictionary";
import { getRoleCatalog, invalidateRoles } from "@/lib/positions/dictionary";

beforeEach(() => {
    vi.clearAllMocks();
    invalidateDictionary();
    invalidateRoles();
    db.keywordAlias.findMany.mockResolvedValue([
        { aliasText: "react", exactText: null, keyword: { id: "k1", displayName: "React", canonicalText: "react", category: "FRAMEWORK" } },
    ]);
    db.canonicalPosition.findMany.mockResolvedValue([{ id: "r1", name: "Frontend Developer", aliases: [{ aliasText: "frontend" }] }]);
});

describe("diccionarios en memoria", () => {
    it("varios pedidos juntos con el diccionario vencido lo leen una sola vez", async () => {
        const dictionaries = await Promise.all([getDictionary(), getDictionary(), getDictionary()]);

        expect(db.keywordAlias.findMany).toHaveBeenCalledTimes(1);
        expect(new Set(dictionaries).size).toBe(1);
        expect(dictionaries[0].keywords.get("k1")?.name).toBe("React");
    });

    it("lo mismo con el catálogo de roles", async () => {
        await Promise.all([getRoleCatalog(), getRoleCatalog()]);

        expect(db.canonicalPosition.findMany).toHaveBeenCalledTimes(1);
    });

    it("si la lectura falla, el próximo pedido vuelve a intentar", async () => {
        db.keywordAlias.findMany.mockRejectedValueOnce(new Error("db down"));

        await expect(getDictionary()).rejects.toThrow("db down");
        await expect(getDictionary()).resolves.toMatchObject({ keywords: expect.any(Map) });
        expect(db.keywordAlias.findMany).toHaveBeenCalledTimes(2);
    });
});
