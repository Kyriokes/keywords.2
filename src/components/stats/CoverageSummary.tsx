import type { KeywordSummary } from "@/lib/stats/keywordAnalysis";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function CoverageSummary({ summary }: { summary: KeywordSummary }) {
  const { coverage, totalApplications, haveCount, missingCount } = summary;

  return (
    <section aria-labelledby="coverage-title" className="space-y-4">
      <h3 id="coverage-title" className="max-w-3xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        Cubrís el {coverage}% de lo que piden{" "}
        {totalApplications === 1 ? "tu postulación" : `tus ${totalApplications} postulaciones`}
      </h3>

      {/* Parte de un todo: lo que tenés y lo que falta, con 2px de separación entre segmentos */}
      <div
        className="flex h-3 gap-0.5"
        role="img"
        aria-label={`Tenés el ${coverage}% de lo pedido y te falta el ${100 - coverage}%`}
      >
        {coverage > 0 && (
          <div
            className={`bg-skill-have ${coverage === 100 ? "rounded-full" : "rounded-l-full"}`}
            style={{ width: `${coverage}%` }}
          />
        )}
        {coverage < 100 && (
          <div className={`flex-1 bg-skill-gap ${coverage === 0 ? "rounded-full" : "rounded-r-full"}`} />
        )}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-skill-have" aria-hidden />
          <dt className="text-muted-foreground">Tenés</dt>
          <dd className="font-medium tabular-nums">{plural(haveCount, "habilidad", "habilidades")}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-skill-gap" aria-hidden />
          <dt className="text-muted-foreground">Te faltan</dt>
          <dd className="font-medium tabular-nums">{plural(missingCount, "habilidad", "habilidades")}</dd>
        </div>
      </dl>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Cada habilidad pesa según cuántas postulaciones la piden: tener una muy pedida suma más que tener
        varias poco pedidas.
      </p>
    </section>
  );
}
