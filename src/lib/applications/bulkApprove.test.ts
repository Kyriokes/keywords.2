import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ jobApplication: { findMany: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ default: db }));

import { approveReadyByScore } from "./bulkApprove";

beforeEach(() => vi.clearAllMocks());

describe("approveReadyByScore", () => {
    it("aprueba las ofertas por aprobar del perfil con match igual o mayor al pedido", async () => {
        db.jobApplication.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);

        const ids = await approveReadyByScore("profile-1", 55);

        expect(db.jobApplication.findMany).toHaveBeenCalledWith({
            where: { profileId: "profile-1", status: "READY", score: { gte: 55 } },
            orderBy: { score: "desc" },
            select: { id: true },
        });
        expect(db.jobApplication.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["a", "b"] }, profileId: "profile-1", status: "READY" },
            data: { status: "APPROVED" },
        });
        expect(ids).toEqual(["a", "b"]);
    });

    it("no actualiza nada si ninguna llega al match", async () => {
        db.jobApplication.findMany.mockResolvedValue([]);

        expect(await approveReadyByScore("profile-1", 90)).toEqual([]);
        expect(db.jobApplication.updateMany).not.toHaveBeenCalled();
    });
});
