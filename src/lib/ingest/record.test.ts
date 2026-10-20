import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
    ingestedOffer: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    searchRun: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));

import { saveSearchRun, upsertIngestedOffers } from "./record";
import type { IngestedOfferInput } from "./stats";
import type { SearchRunResult } from "./run";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const offer = (externalId: string, fields: Partial<IngestedOfferInput> = {}): IngestedOfferInput => ({
    externalId, source: "remotive", board: null, title: "Full Stack Developer", company: "Acme", location: "Worldwide",
    url: `https://remotive.com/${externalId}`, roleName: "Full Stack Developer", seniority: null, decision: "QUEUED", reason: null, score: 70, ...fields,
});

beforeEach(() => {
    vi.clearAllMocks();
    db.ingestedOffer.createMany.mockResolvedValue({ count: 1 });
    db.ingestedOffer.updateMany.mockResolvedValue({ count: 1 });
});

describe("upsertIngestedOffers", () => {
    it("crea las nuevas y actualiza las conocidas agrupadas por decisión", async () => {
        db.ingestedOffer.findMany.mockResolvedValue([{ externalId: "remotive:1" }, { externalId: "remotive:2" }, { externalId: "remotive:3" }]);

        const result = await upsertIngestedOffers("profile-1", [
            offer("remotive:1", { decision: "IN_ACCOUNT", roleName: null, score: null }),
            offer("remotive:2", { decision: "REJECTED", reason: "Solo para USA", score: null }),
            offer("remotive:3", { decision: "REJECTED", reason: "Solo para USA", score: null }),
            offer("remotive:4"),
        ], NOW);

        expect(db.ingestedOffer.createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({ profileId: "profile-1", externalId: "remotive:4", decision: "QUEUED", firstSeenAt: NOW, lastSeenAt: NOW })],
            skipDuplicates: true,
        });
        expect(db.ingestedOffer.updateMany.mock.calls).toEqual([
            [{ where: { profileId: "profile-1", externalId: { in: ["remotive:1"] } }, data: { lastSeenAt: NOW, timesSeen: { increment: 1 } } }],
            [{
                where: { profileId: "profile-1", externalId: { in: ["remotive:2", "remotive:3"] } },
                data: { lastSeenAt: NOW, timesSeen: { increment: 1 }, decision: "REJECTED", reason: "Solo para USA", score: null },
            }],
        ]);
        expect(result).toEqual({ created: 1, updated: 3 });
    });

    it("sin ofertas no toca la base", async () => {
        expect(await upsertIngestedOffers("profile-1", [], NOW)).toEqual({ created: 0, updated: 0 });
        expect(db.ingestedOffer.findMany).not.toHaveBeenCalled();
    });
});

describe("saveSearchRun", () => {
    it("guarda la corrida con el desglose, registra las ofertas y borra las viejas", async () => {
        db.ingestedOffer.findMany.mockResolvedValue([]);
        const result = {
            fetched: 2, fresh: 2, matchedRole: 1, filtered: 0, created: 1, deferred: 0, decisions: [], errors: ["jobicy: 500"], summary: "",
            offers: [offer("remotive:1")],
            bySource: { remotive: { fetched: 2, fresh: 2, matchedRole: 1, passed: 1, rejected: 0, error: null } },
        } satisfies SearchRunResult;

        await saveSearchRun("profile-1", "CRON", result, 1234, NOW);

        expect(db.searchRun.create).toHaveBeenCalledWith({
            data: {
                profileId: "profile-1", trigger: "CRON", durationMs: 1234, fetched: 2, fresh: 2, matchedRole: 1, filtered: 0, created: 1, deferred: 0,
                bySource: result.bySource, errors: ["jobicy: 500"],
            },
        });
        expect(db.ingestedOffer.createMany).toHaveBeenCalled();
        expect(db.ingestedOffer.deleteMany).toHaveBeenCalledWith({
            where: { profileId: "profile-1", lastSeenAt: { lt: new Date("2026-07-23T12:00:00.000Z") } },
        });
    });
});
