import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadSeed } from "../../../prisma/dictionary/seed-data";
import { seedRoleSources } from "../../../prisma/dictionary/roles-data";
import { findMentions, tokenizeText, type AliasIndex } from "@/lib/keywords/core";
import { buildRoleDictionary, classifyTitle } from "@/lib/positions/classify";
import { summarizeKeywords } from "@/lib/stats/keywordAnalysis";
import { DAILY_ANALYSES } from "./copy";
import {
  SAMPLE_APPLICATIONS,
  SAMPLE_APPLICATION_IDS,
  SAMPLE_BY_APPLICATION,
  SAMPLE_KEYWORDS,
  SAMPLE_OFFER,
} from "./sample-data";

// La landing muestra el producto con datos inventados. Estos tests garantizan que esos datos
// se comportan igual que los reales: mismo diccionario, mismo clasificador, mismo cálculo.

const seed = loadSeed();
const seedByName = new Map(seed.map((entry) => [entry.name, entry]));

const aliasIndex: AliasIndex = new Map(
  seed.flatMap((entry) =>
    entry.aliases.map((alias) => [alias.aliasText, { keywordId: entry.name, exactText: alias.exactText }] as const)
  )
);

const roleDictionary = buildRoleDictionary(seedRoleSources());

describe("datos de ejemplo de la landing", () => {
  it("usa habilidades que existen en el diccionario, con su categoría", () => {
    for (const keyword of SAMPLE_KEYWORDS) {
      expect(seedByName.get(keyword.name)?.category, keyword.name).toBe(keyword.category);
    }
  });

  it("muestra en la oferta lo mismo que detecta el diccionario", () => {
    const tokens = tokenizeText(SAMPLE_OFFER.text);
    const detected = findMentions(tokens, aliasIndex).map((mention) => ({
      written: tokens
        .slice(mention.start, mention.start + mention.size)
        .map((token) => token.raw)
        .join(" "),
      name: mention.keywordId,
    }));

    expect(detected).toEqual(SAMPLE_OFFER.detected);
  });

  it("clasifica cada título con el rol y el seniority que declara", () => {
    for (const application of SAMPLE_APPLICATIONS) {
      const { roleId, seniority } = classifyTitle(application.title, roleDictionary);
      expect({ roleId, seniority }, application.title).toEqual({
        roleId: application.role,
        seniority: application.seniority,
      });
    }
  });

  it("solo pide habilidades que están en la lista de ejemplo", () => {
    const known = new Set(SAMPLE_KEYWORDS.map((keyword) => keyword.id));
    for (const application of SAMPLE_APPLICATIONS) {
      expect(application.keywords.filter((id) => !known.has(id)), application.title).toEqual([]);
      expect(new Set(application.keywords).size, application.title).toBe(application.keywords.length);
    }
  });

  it("deja margen para simular: hay cobertura, faltantes, y sumar la primera la sube", () => {
    const input = {
      keywords: SAMPLE_KEYWORDS,
      byApplication: SAMPLE_BY_APPLICATION,
      applicationIds: SAMPLE_APPLICATION_IDS,
    };
    const summary = summarizeKeywords(input);
    const simulated = summarizeKeywords({ ...input, simulatedIds: new Set([summary.gaps[0].id]) });

    expect(summary.coverage).toBeGreaterThan(0);
    expect(summary.coverage).toBeLessThan(100);
    expect(simulated.simulatedCoverage).toBeGreaterThan(summary.coverage);
  });
});

describe("textos de la landing", () => {
  it("anuncia el mismo cupo diario que define el esquema", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const limit = schema.match(/dailyAnalysesLimit\s+Int\s+@default\((\d+)\)/)?.[1];

    expect(Number(limit)).toBe(DAILY_ANALYSES);
  });
});
