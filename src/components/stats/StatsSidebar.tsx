import { CATEGORY_LABELS } from "@/lib/keywords/categories";
import type { KeywordSummary } from "@/lib/stats/keywordAnalysis";
import { formatPoints } from "./format";

const TOP_GAPS = 5;

interface StatsSidebarProps {
  summary: KeywordSummary;
  onToggleSimulated: (id: string) => void;
}

export function StatsSidebar({ summary, onToggleSimulated }: StatsSidebarProps) {
  return (
    <aside className="space-y-8">
      <TopGaps summary={summary} onToggleSimulated={onToggleSimulated} />
      <CategoryCoverageList summary={summary} />
    </aside>
  );
}

/** Las faltantes que más cobertura dan, con su casilla para simular que se suman. */
export function TopGaps({ summary, onToggleSimulated }: StatsSidebarProps) {
  const gaps = summary.gaps.slice(0, TOP_GAPS);

  return (
    <section aria-labelledby="gaps-title" className="space-y-3">
      <div>
        <h3 id="gaps-title" className="text-lg font-semibold tracking-tight">
          Qué sumar primero
        </h3>
        <p className="text-sm text-muted-foreground">
          Las faltantes que más cobertura te dan. Tildalas para simular que las sumás.
        </p>
      </div>

      {gaps.length > 0 ? (
        <ol className="divide-y border-y">
          {gaps.map((gap) => (
            <li key={gap.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[var(--skill-have)]"
                  checked={gap.simulated}
                  onChange={() => onToggleSimulated(gap.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{gap.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    La piden {gap.demand} de {summary.totalApplications}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{formatPoints(gap.points)}</span>
              </label>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-y py-4 text-sm text-muted-foreground">
          No te falta nada de lo que piden estas postulaciones.
        </p>
      )}
    </section>
  );
}

function CategoryCoverageList({ summary }: Pick<StatsSidebarProps, "summary">) {
  if (summary.byCategory.length === 0) return null;

  return (
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
  );
}
