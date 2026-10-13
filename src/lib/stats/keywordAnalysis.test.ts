import { describe, expect, it } from "vitest";
import { summarizeKeywords, type InsightKeyword } from "./keywordAnalysis";

const keyword = (id: string, inCv: boolean, extra: Partial<InsightKeyword> = {}): InsightKeyword => ({
  id,
  name: id,
  category: "LENGUAJE",
  verified: true,
  inCv,
  ...extra,
});

// 4 postulaciones: react en las 4, sql en 2, docker en 1, rust en 1
const byApplication = {
  a1: ["react", "sql"],
  a2: ["react", "sql", "docker"],
  a3: ["react"],
  a4: ["react", "rust"],
};
const applicationIds = Object.keys(byApplication);
const keywords = [
  keyword("react", true, { category: "FRAMEWORK" }),
  keyword("sql", false),
  keyword("docker", false, { category: "CLOUD_DEVOPS" }),
  keyword("rust", true),
];

describe("summarizeKeywords", () => {
  it("pondera la cobertura por demanda, no por cantidad de keywords", () => {
    const summary = summarizeKeywords({ keywords, byApplication, applicationIds });

    // Demanda total 8; cubierta: react (4) + rust (1) = 5 → 62,5%
    expect(summary.coverage).toBe(63);
    expect(summary.haveCount).toBe(2);
    expect(summary.missingCount).toBe(2);
    expect(summary.totalApplications).toBe(4);
  });

  it("ordena por demanda y calcula los puntos que suma cada faltante", () => {
    const summary = summarizeKeywords({ keywords, byApplication, applicationIds });

    expect(summary.stats.map((stat) => [stat.id, stat.demand])).toEqual([
      ["react", 4], ["sql", 2], ["docker", 1], ["rust", 1],
    ]);
    expect(summary.gaps.map((gap) => [gap.id, gap.points])).toEqual([
      ["sql", 25], ["docker", 12.5],
    ]);
  });

  it("recalcula con el filtro de postulaciones", () => {
    const summary = summarizeKeywords({ keywords, byApplication, applicationIds: ["a1", "a2"] });

    // Demanda: react 2, sql 2, docker 1 → cubierta 2 de 5
    expect(summary.coverage).toBe(40);
    expect(summary.stats.map((stat) => stat.id)).toEqual(["react", "sql", "docker"]);
  });

  it("saca del cálculo las ocultas pero las sigue listando", () => {
    const summary = summarizeKeywords({
      keywords, byApplication, applicationIds, hiddenIds: new Set(["sql"]),
    });

    // Sin sql la demanda es 6; cubierta 5 → 83%
    expect(summary.coverage).toBe(83);
    expect(summary.missingCount).toBe(1);
    expect(summary.stats.find((stat) => stat.id === "sql")?.points).toBe(0);
    expect(summary.gaps.map((gap) => gap.id)).toEqual(["docker"]);
  });

  it("puede excluir las keywords sin verificar", () => {
    const withUnverified = [...keywords, keyword("proactividad", false, { verified: false, category: "OTRA" })];
    const apps = { ...byApplication, a1: [...byApplication.a1, "proactividad"] };

    const all = summarizeKeywords({ keywords: withUnverified, byApplication: apps, applicationIds });
    const verifiedOnly = summarizeKeywords({
      keywords: withUnverified, byApplication: apps, applicationIds, includeUnverified: false,
    });

    expect(all.missingCount).toBe(3);
    expect(verifiedOnly.missingCount).toBe(2);
    expect(verifiedOnly.coverage).toBe(63);
  });

  it("agrupa la cobertura por categoría en el orden del diccionario", () => {
    const summary = summarizeKeywords({ keywords, byApplication, applicationIds });

    expect(summary.byCategory).toEqual([
      { category: "LENGUAJE", coverage: 33, have: 1, missing: 1 },
      { category: "FRAMEWORK", coverage: 100, have: 1, missing: 0 },
      { category: "CLOUD_DEVOPS", coverage: 0, have: 0, missing: 1 },
    ]);
  });

  it("no cuenta dos veces una keyword repetida en la misma postulación", () => {
    const summary = summarizeKeywords({
      keywords, byApplication: { a1: ["react", "react"] }, applicationIds: ["a1"],
    });
    expect(summary.stats).toMatchObject([{ id: "react", demand: 1 }]);
  });

  it("devuelve ceros cuando no hay nada que analizar", () => {
    const summary = summarizeKeywords({ keywords, byApplication, applicationIds: [] });
    expect(summary).toMatchObject({ coverage: 0, haveCount: 0, missingCount: 0, stats: [], gaps: [] });
  });
});
