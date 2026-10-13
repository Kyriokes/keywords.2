import { KEYWORD_CATEGORIES, type KeywordCategory } from "@/lib/keywords/categories";

/** Una keyword pedida por las postulaciones del usuario, ya cruzada con su CV. */
export interface InsightKeyword {
  id: string;
  name: string;
  category: KeywordCategory;
  /** false si el término todavía no está en el diccionario. */
  verified: boolean;
  inCv: boolean;
}

export interface KeywordStat extends InsightKeyword {
  /** Postulaciones (del filtro actual) que la piden. */
  demand: number;
  /** Puntos de cobertura que aporta (si la tenés) o que sumarías (si te falta). */
  points: number;
  /** El usuario la tildó para simular que la suma a su CV. Solo vale para las que faltan y cuentan. */
  simulated: boolean;
}

export interface CategoryCoverage {
  category: KeywordCategory;
  /** 0 a 100. */
  coverage: number;
  have: number;
  missing: number;
}

export interface KeywordSummary {
  totalApplications: number;
  /** Cobertura ponderada por demanda, de 0 a 100. */
  coverage: number;
  /** Cobertura que habría si el CV sumara las habilidades tildadas; igual a `coverage` si no hay ninguna. */
  simulatedCoverage: number;
  /** Cuántas de las que faltan están tildadas en la simulación. */
  simulatedCount: number;
  haveCount: number;
  missingCount: number;
  /** Todas las keywords del filtro, ordenadas por demanda. Incluye las ocultas. */
  stats: KeywordStat[];
  /** Las que faltan, de la que más cobertura suma a la que menos. */
  gaps: KeywordStat[];
  byCategory: CategoryCoverage[];
}

export interface SummarizeInput {
  keywords: InsightKeyword[];
  /** Ids de keyword por postulación. */
  byApplication: Record<string, string[]>;
  /** Postulaciones que entran en el cálculo (ya filtradas por puesto). */
  applicationIds: string[];
  /** Keywords que el usuario sacó del cálculo. */
  hiddenIds?: ReadonlySet<string>;
  /** Keywords faltantes que el usuario tildó para simular que las suma. */
  simulatedIds?: ReadonlySet<string>;
  includeUnverified?: boolean;
}

/**
 * Resume qué pide el mercado y cuánto de eso cubre el CV.
 *
 * La cobertura se pondera por demanda: una habilidad pedida en 30 postulaciones pesa 30 veces
 * más que una pedida en una sola. Las ocultas y (si se excluyen) las sin verificar no cuentan.
 */
export function summarizeKeywords({
  keywords,
  byApplication,
  applicationIds,
  hiddenIds = new Set(),
  simulatedIds = new Set(),
  includeUnverified = true,
}: SummarizeInput): KeywordSummary {
  const demandById = new Map<string, number>();
  for (const applicationId of applicationIds) {
    for (const keywordId of new Set(byApplication[applicationId] ?? [])) {
      demandById.set(keywordId, (demandById.get(keywordId) ?? 0) + 1);
    }
  }

  const requested = keywords
    .filter((keyword) => demandById.has(keyword.id))
    .filter((keyword) => includeUnverified || keyword.verified);

  const counted = requested.filter((keyword) => !hiddenIds.has(keyword.id));
  const totalDemand = counted.reduce((sum, keyword) => sum + demandById.get(keyword.id)!, 0);
  const share = (demand: number) => (totalDemand > 0 ? (demand / totalDemand) * 100 : 0);

  const stats: KeywordStat[] = requested
    .map((keyword) => {
      const demand = demandById.get(keyword.id)!;
      const hidden = hiddenIds.has(keyword.id);
      return {
        ...keyword,
        demand,
        points: hidden ? 0 : share(demand),
        simulated: !keyword.inCv && !hidden && simulatedIds.has(keyword.id),
      };
    })
    .sort((a, b) => b.demand - a.demand || a.name.localeCompare(b.name, "es"));

  const countedStats = stats.filter((stat) => !hiddenIds.has(stat.id));
  const have = countedStats.filter((stat) => stat.inCv);
  const gaps = countedStats.filter((stat) => !stat.inCv);

  const byCategory: CategoryCoverage[] = KEYWORD_CATEGORIES.flatMap((category) => {
    const inCategory = countedStats.filter((stat) => stat.category === category);
    if (inCategory.length === 0) return [];

    const demand = inCategory.reduce((sum, stat) => sum + stat.demand, 0);
    const covered = inCategory.filter((stat) => stat.inCv).reduce((sum, stat) => sum + stat.demand, 0);
    return [{
      category,
      coverage: Math.round((covered / demand) * 100),
      have: inCategory.filter((stat) => stat.inCv).length,
      missing: inCategory.filter((stat) => !stat.inCv).length,
    }];
  });

  const sumPoints = (items: KeywordStat[]) => items.reduce((sum, stat) => sum + stat.points, 0);
  const simulated = gaps.filter((stat) => stat.simulated);

  return {
    totalApplications: applicationIds.length,
    coverage: Math.round(sumPoints(have)),
    simulatedCoverage: Math.round(sumPoints(have) + sumPoints(simulated)),
    simulatedCount: simulated.length,
    haveCount: have.length,
    missingCount: gaps.length,
    stats,
    gaps,
    byCategory,
  };
}

export interface ApplicationMatch {
  /** Keywords de la postulación que están en el CV. */
  have: number;
  /** Keywords que pide la postulación. */
  total: number;
  /** have / total, de 0 a 1; 0 si la postulación no tiene keywords. */
  ratio: number;
  /** Las keywords de la postulación, primero las que faltan. */
  keywords: InsightKeyword[];
}

/** Cuánto de lo que pide cada postulación está en el CV. */
export function matchByApplication(
  keywords: InsightKeyword[],
  byApplication: Record<string, string[]>
): Record<string, ApplicationMatch> {
  const keywordById = new Map(keywords.map((keyword) => [keyword.id, keyword]));

  const matches: Record<string, ApplicationMatch> = {};
  for (const [applicationId, keywordIds] of Object.entries(byApplication)) {
    const requested = Array.from(new Set(keywordIds))
      .flatMap((keywordId) => keywordById.get(keywordId) ?? [])
      .sort((a, b) => Number(a.inCv) - Number(b.inCv) || a.name.localeCompare(b.name, "es"));

    const have = requested.filter((keyword) => keyword.inCv).length;
    matches[applicationId] = {
      have,
      total: requested.length,
      ratio: requested.length > 0 ? have / requested.length : 0,
      keywords: requested,
    };
  }
  return matches;
}
