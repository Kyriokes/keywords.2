"use client";

import { useMemo, useState } from "react";
import { CoverageSummary } from "@/components/stats/CoverageSummary";
import { TopGaps } from "@/components/stats/StatsSidebar";
import { summarizeKeywords } from "@/lib/stats/keywordAnalysis";
import { DEMO } from "./copy";
import { SAMPLE_APPLICATION_IDS, SAMPLE_BY_APPLICATION, SAMPLE_KEYWORDS } from "./sample-data";
import { productFrame, productSurface } from "./styles";

/**
 * El visual del hero: la pantalla de Estadísticas funcionando, con los mismos componentes
 * y el mismo cálculo que la app. Lo único inventado son los datos.
 */
export function HeroDemo() {
  const [simulatedIds, setSimulatedIds] = useState<string[]>([]);

  const summary = useMemo(
    () =>
      summarizeKeywords({
        keywords: SAMPLE_KEYWORDS,
        byApplication: SAMPLE_BY_APPLICATION,
        applicationIds: SAMPLE_APPLICATION_IDS,
        simulatedIds: new Set(simulatedIds),
      }),
    [simulatedIds]
  );

  const toggleSimulated = (id: string) =>
    setSimulatedIds((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]));

  return (
    <section aria-labelledby="demo-title" className={productFrame}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-2 pb-4 text-left">
        <h2 id="demo-title" className="text-sm font-semibold">
          {DEMO.title}
        </h2>
        <p className="text-sm text-muted-foreground">{DEMO.note}</p>
      </div>

      <div className={`${productSurface} grid grid-cols-1 gap-x-12 gap-y-8 p-6 text-left sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem]`}>
        <CoverageSummary summary={summary} onClearSimulation={() => setSimulatedIds([])} />
        <TopGaps summary={summary} onToggleSimulated={toggleSimulated} />
      </div>
    </section>
  );
}
