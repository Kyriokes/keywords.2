import { CATEGORY_LABELS } from "@/lib/keywords/categories";
import type { KeywordSummary } from "@/lib/stats/keywordAnalysis";

const TOP_GAPS = 5;

function formatPoints(points: number): string {
  const rounded = Math.round(points);
  return rounded >= 1 ? `+${rounded} ${rounded === 1 ? "pt" : "pts"}` : "menos de 1 pt";
}

export function StatsSidebar({ summary }: { summary: KeywordSummary }) {
  const gaps = summary.gaps.slice(0, TOP_GAPS);

  return (
    <aside className="space-y-8">
      <section aria-labelledby="gaps-title" className="space-y-3">
        <div>
          <h3 id="gaps-title" className="text-lg font-semibold tracking-tight">
            Qué sumar primero
          </h3>
          <p className="text-sm text-muted-foreground">Las faltantes que más cobertura te dan.</p>
        </div>

        {gaps.length > 0 ? (
          <ol className="divide-y border-y">
            {gaps.map((gap) => (
              <li key={gap.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{gap.name}</p>
                  <p className="text-xs text-muted-foreground">
                    La piden {gap.demand} de {summary.totalApplications}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums">{formatPoints(gap.points)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-y py-4 text-sm text-muted-foreground">
            No te falta nada de lo que piden estas postulaciones.
          </p>
        )}
      </section>

      {summary.byCategory.length > 0 && (
        <section aria-labelledby="categories-title" className="space-y-3">
          <h3 id="categories-title" className="text-lg font-semibold tracking-tight">
            Por categoría
          </h3>
          <ul className="space-y-3">
            {summary.byCategory.map((item) => (
              <li
                key={item.category}
                className="space-y-1.5"
                title={`Tenés ${item.have} de ${item.have + item.missing} habilidades de esta categoría`}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{CATEGORY_LABELS[item.category]}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{item.coverage}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-[4px] bg-muted">
                  <div className="h-full rounded-r-[4px] bg-skill-have" style={{ width: `${item.coverage}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
