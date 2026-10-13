"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KeywordInsights } from "@/actions/insights-actions";
import { summarizeKeywords } from "@/lib/stats/keywordAnalysis";
import { CoverageSummary } from "./CoverageSummary";
import { DemandRanking } from "./DemandRanking";
import { StatsSidebar } from "./StatsSidebar";

/** Chip que reúne las postulaciones cuyo título no corresponde a ningún rol del diccionario. */
const UNCLASSIFIED = "Sin clasificar";

interface StatsDashboardProps {
  cvs: Array<{ id: string; name: string }>;
  activeCvId?: string;
  onSelectCv: (id: string) => void;
  applications: Array<{ id: string; role?: string }>;
  /** Puestos deseados del usuario: si alguno aparece en sus postulaciones, el análisis arranca filtrado por ellos. */
  preferredRoles?: string[];
  insights: KeywordInsights | null;
  isLoading: boolean;
}

const NO_ROLES: string[] = [];

export function StatsDashboard({
  cvs,
  activeCvId,
  onSelectCv,
  applications,
  preferredRoles = NO_ROLES,
  insights,
  isLoading,
}: StatsDashboardProps) {
  // Se guarda lo que el usuario saca, no lo que queda: así un puesto o una habilidad
  // nuevos entran al cálculo sin tener que sincronizar nada. null = todavía no tocó los puestos.
  const [excludedOverride, setExcludedOverride] = useState<string[] | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  // Habilidades faltantes que el usuario tildó para simular que las suma a su CV
  const [simulatedIds, setSimulatedIds] = useState<string[]>([]);
  const [includeUnverified, setIncludeUnverified] = useState(true);

  // Los puestos son roles estandarizados, no títulos de oferta: así no crecen con cada postulación
  const positions = useMemo(() => {
    const roles = Array.from(new Set(applications.flatMap((app) => (app.role ? [app.role] : [])))).sort();
    return applications.some((app) => !app.role) ? [...roles, UNCLASSIFIED] : roles;
  }, [applications]);
  // Puestos deseados que el usuario efectivamente tiene cargados: son el filtro por defecto
  const preferredPositions = useMemo(
    () => positions.filter((position) => preferredRoles.includes(position)),
    [positions, preferredRoles]
  );
  const selectedPositions = useMemo(() => {
    const excluded =
      excludedOverride ??
      (preferredPositions.length > 0 ? positions.filter((p) => !preferredPositions.includes(p)) : []);

    const selected = positions.filter((position) => !excluded.includes(position));
    // Si lo elegido ya no existe (por ejemplo, se borraron esas postulaciones) se vuelve a mostrar todo
    return selected.length > 0 ? selected : positions;
  }, [positions, preferredPositions, excludedOverride]);

  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const simulatedSet = useMemo(() => new Set(simulatedIds), [simulatedIds]);

  const summary = useMemo(() => {
    const applicationIds = applications
      .filter((app) => selectedPositions.includes(app.role ?? UNCLASSIFIED))
      .map((app) => app.id);

    return summarizeKeywords({
      keywords: insights?.keywords ?? [],
      byApplication: insights?.byApplication ?? {},
      applicationIds,
      hiddenIds: hiddenSet,
      simulatedIds: simulatedSet,
      includeUnverified,
    });
  }, [applications, insights, selectedPositions, hiddenSet, simulatedSet, includeUnverified]);

  const togglePosition = (position: string) => {
    const excluded = positions.filter((item) => !selectedPositions.includes(item));
    if (excluded.includes(position)) {
      setExcludedOverride(excluded.filter((item) => item !== position));
    } else if (selectedPositions.length > 1) {
      // Tiene que quedar al menos un puesto en el análisis
      setExcludedOverride([...excluded, position]);
    }
  };

  const toggle = (id: string) => (previous: string[]) =>
    previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];

  const toggleHidden = (id: string) => setHiddenIds(toggle(id));
  const toggleSimulated = (id: string) => setSimulatedIds(toggle(id));

  // "Solo mis puestos deseados" tiene sentido si el filtro por defecto no es "todos" y el usuario lo cambió
  const canRestorePreferred =
    excludedOverride !== null && preferredPositions.length > 0 && preferredPositions.length < positions.length;

  if (applications.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay postulaciones para analizar"
        description="Cargá las ofertas a las que te postulás y acá vas a ver qué habilidades se repiten y cuáles te faltan."
        href="/user/add-job"
        action="Agregar postulación"
      />
    );
  }

  const hasCv = Boolean(insights?.cvId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {cvs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" id="stats-cv-label">CV</span>
            <Select value={activeCvId} onValueChange={onSelectCv}>
              <SelectTrigger className="h-8 w-60" aria-labelledby="stats-cv-label">
                <SelectValue placeholder="Elegí un CV" />
              </SelectTrigger>
              <SelectContent>
                {cvs.map((cv) => (
                  <SelectItem key={cv.id} value={cv.id}>
                    {cv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {positions.length > 1 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="stats-positions-label">
            <span className="text-sm text-muted-foreground" id="stats-positions-label">Puestos</span>
            {positions.map((position) => {
              const selected = selectedPositions.includes(position);
              return (
                <Button
                  key={position}
                  type="button"
                  size="sm"
                  variant={selected ? "secondary" : "outline"}
                  aria-pressed={selected}
                  onClick={() => togglePosition(position)}
                  className={`h-7 max-w-56 rounded-full ${selected ? "" : "text-muted-foreground"}`}
                >
                  {/* El tilde marca la selección sin depender del contraste entre fondos */}
                  {selected && <Check className="size-3.5" aria-hidden />}
                  <span className="truncate">{position}</span>
                </Button>
              );
            })}
            {selectedPositions.length < positions.length && (
              <Button type="button" variant="link" size="sm" className="h-7 px-1" onClick={() => setExcludedOverride([])}>
                Marcar todos
              </Button>
            )}
            {canRestorePreferred && (
              <Button type="button" variant="link" size="sm" className="h-7 px-1" onClick={() => setExcludedOverride(null)}>
                Solo mis puestos deseados
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading && !insights ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Calculando qué piden tus postulaciones…</p>
      ) : summary.stats.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Estas postulaciones no tienen habilidades detectadas todavía.
        </p>
      ) : (
        <>
          {hasCv ? (
            <CoverageSummary summary={summary} onClearSimulation={() => setSimulatedIds([])} />
          ) : (
            <EmptyState
              title="Subí tu CV para medir cuánto cubrís"
              description="Ya sabemos qué piden tus postulaciones. Con tu CV te mostramos qué tenés y qué te conviene sumar."
              href="/user/profile"
              action="Ir a Mi perfil"
              compact
            />
          )}

          <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <DemandRanking
              summary={summary}
              hasCv={hasCv}
              hiddenIds={hiddenSet}
              onToggleHidden={toggleHidden}
              onResetHidden={() => setHiddenIds([])}
              onToggleSimulated={toggleSimulated}
              includeUnverified={includeUnverified}
              onIncludeUnverifiedChange={setIncludeUnverified}
            />
            {hasCv && <StatsSidebar summary={summary} onToggleSimulated={toggleSimulated} />}
          </div>
        </>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  href: string;
  action: string;
  compact?: boolean;
}

function EmptyState({ title, description, href, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-start gap-3 rounded-lg border border-dashed ${compact ? "p-5" : "p-8"}`}>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild size="sm">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}
