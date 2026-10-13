import { Button } from "@/components/ui/button";
import type { KeywordSummary } from "@/lib/stats/keywordAnalysis";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

interface CoverageSummaryProps {
  summary: KeywordSummary;
  onClearSimulation: () => void;
}

export function CoverageSummary({ summary, onClearSimulation }: CoverageSummaryProps) {
  const { coverage, simulatedCoverage, simulatedCount, totalApplications, haveCount, missingCount } = summary;
  const gain = simulatedCoverage - coverage;
  const isSimulating = simulatedCount > 0;

  // Segmentos de la barra, de izquierda a derecha: lo que tenés, lo que sumarías, lo que falta
  const segments = [
    { key: "have", width: coverage, className: "bg-skill-have" },
    { key: "simulated", width: gain, className: "bg-skill-have/50" },
    { key: "gap", width: 100 - simulatedCoverage, className: "bg-skill-gap" },
  ].filter((segment) => segment.width > 0);

  return (
    <section aria-labelledby="coverage-title" className="space-y-4">
      <h3 id="coverage-title" className="max-w-3xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        Cubrís el {coverage}% de lo que piden{" "}
        {totalApplications === 1 ? "tu postulación" : `tus ${totalApplications} postulaciones`}
      </h3>

      {/* Parte de un todo, con 2px de separación entre segmentos */}
      <div
        className="flex h-3 gap-0.5"
        role="img"
        aria-label={
          isSimulating
            ? `Tenés el ${coverage}% de lo pedido; con lo que marcaste llegarías al ${simulatedCoverage}%`
            : `Tenés el ${coverage}% de lo pedido y te falta el ${100 - coverage}%`
        }
      >
        {segments.map((segment, index) => (
          <div
            key={segment.key}
            className={`${segment.className} ${index === 0 ? "rounded-l-full" : ""} ${
              index === segments.length - 1 ? "rounded-r-full" : ""
            }`}
            style={{ width: `${segment.width}%` }}
          />
        ))}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-skill-have" aria-hidden />
          <dt className="text-muted-foreground">Tenés</dt>
          <dd className="font-medium tabular-nums">{plural(haveCount, "habilidad", "habilidades")}</dd>
        </div>
        {isSimulating && (
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-skill-have/50" aria-hidden />
            <dt className="text-muted-foreground">Sumarías</dt>
            <dd className="font-medium tabular-nums">{plural(simulatedCount, "habilidad", "habilidades")}</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-skill-gap" aria-hidden />
          <dt className="text-muted-foreground">Te faltan</dt>
          <dd className="font-medium tabular-nums">
            {plural(missingCount - simulatedCount, "habilidad", "habilidades")}
          </dd>
        </div>
      </dl>

      {isSimulating ? (
        <p className="flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-live="polite">
          <span>
            Si sumás {simulatedCount === 1 ? "la que marcaste" : `las ${simulatedCount} que marcaste`} llegás al{" "}
            <span className="font-semibold tabular-nums">{simulatedCoverage}%</span>
            {gain > 0 ? ` (${gain} ${gain === 1 ? "punto" : "puntos"} más).` : " (menos de 1 punto más)."}
          </span>
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onClearSimulation}>
            Quitar la simulación
          </Button>
        </p>
      ) : (
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cada habilidad pesa según cuántas postulaciones la piden. Tildá las que te faltan para simular cuánto
          subiría tu cobertura si las sumaras.
        </p>
      )}
    </section>
  );
}
