"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_LABELS, type KeywordCategory } from "@/lib/keywords/categories";
import type { KeywordStat, KeywordSummary } from "@/lib/stats/keywordAnalysis";
import { formatPoints } from "./format";

const PAGE_SIZE = 12;

type StateFilter = "all" | "missing" | "have";

const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "missing", label: "Te faltan" },
  { value: "have", label: "Tenés" },
];

interface DemandRankingProps {
  summary: KeywordSummary;
  /** Sin CV no se puede decir qué tenés: se muestra solo la demanda. */
  hasCv: boolean;
  hiddenIds: ReadonlySet<string>;
  onToggleHidden: (id: string) => void;
  onResetHidden: () => void;
  /** Marca o desmarca una habilidad faltante en la simulación. */
  onToggleSimulated: (id: string) => void;
  includeUnverified: boolean;
  onIncludeUnverifiedChange: (value: boolean) => void;
}

export function DemandRanking({
  summary,
  hasCv,
  hiddenIds,
  onToggleHidden,
  onResetHidden,
  onToggleSimulated,
  includeUnverified,
  onIncludeUnverifiedChange,
}: DemandRankingProps) {
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [category, setCategory] = useState<KeywordCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Cualquier cambio de filtro vuelve al principio de la lista
  const changeFilter = (apply: () => void) => {
    apply();
    setVisibleCount(PAGE_SIZE);
  };

  const categories = summary.byCategory.map((item) => item.category);
  const hiddenCount = summary.stats.filter((stat) => hiddenIds.has(stat.id)).length;
  const search = query.trim().toLowerCase();

  const rows = summary.stats.filter((stat) => {
    if (hiddenIds.has(stat.id) && !showHidden) return false;
    if (stateFilter === "have" && !stat.inCv) return false;
    if (stateFilter === "missing" && stat.inCv) return false;
    if (category !== "all" && stat.category !== category) return false;
    return !search || stat.name.toLowerCase().includes(search);
  });
  const visibleRows = rows.slice(0, visibleCount);
  const remaining = rows.length - visibleRows.length;

  return (
    <section aria-labelledby="ranking-title" className="min-w-0 space-y-4">
      <h3 id="ranking-title" className="text-lg font-semibold tracking-tight">
        Lo que más te piden
      </h3>

      <div className="flex flex-wrap items-center gap-3">
        {hasCv && (
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Filtrar por estado">
            {STATE_FILTERS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={stateFilter === option.value ? "secondary" : "ghost"}
                aria-pressed={stateFilter === option.value}
                onClick={() => changeFilter(() => setStateFilter(option.value))}
                className="h-7"
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}

        <Input
          type="search"
          value={query}
          onChange={(event) => changeFilter(() => setQuery(event.target.value))}
          placeholder="Buscar habilidad"
          aria-label="Buscar habilidad"
          className="h-8 w-full sm:w-48"
        />

        {categories.length > 1 && (
          <Select
            value={category}
            onValueChange={(value) => changeFilter(() => setCategory(value as KeywordCategory | "all"))}
          >
            <SelectTrigger className="h-8 w-full sm:w-52" aria-label="Filtrar por categoría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((item) => (
                <SelectItem key={item} value={item}>
                  {CATEGORY_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={includeUnverified}
            onChange={(event) => changeFilter(() => onIncludeUnverifiedChange(event.target.checked))}
          />
          Incluir sin verificar
        </label>
      </div>

      {visibleRows.length > 0 ? (
        <ul className="divide-y border-y">
          {visibleRows.map((stat) => (
            <RankingRow
              key={stat.id}
              stat={stat}
              total={summary.totalApplications}
              hasCv={hasCv}
              isHidden={hiddenIds.has(stat.id)}
              onToggleHidden={() => onToggleHidden(stat.id)}
              onToggleSimulated={() => onToggleSimulated(stat.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="border-y py-8 text-center text-sm text-muted-foreground">
          Ninguna habilidad coincide con estos filtros.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {hiddenCount > 0 ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {hiddenCount === 1 ? "1 habilidad fuera del cálculo" : `${hiddenCount} habilidades fuera del cálculo`}
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setShowHidden(!showHidden)}>
              {showHidden ? "Dejar de mostrarlas" : "Mostrarlas"}
            </Button>
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onResetHidden}>
              Volver a contarlas
            </Button>
          </p>
        ) : (
          <span />
        )}

        {remaining > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}>
            Ver más ({remaining})
          </Button>
        )}
      </div>
    </section>
  );
}

interface RankingRowProps {
  stat: KeywordStat;
  total: number;
  hasCv: boolean;
  isHidden: boolean;
  onToggleHidden: () => void;
  onToggleSimulated: () => void;
}

function RankingRow({ stat, total, hasCv, isHidden, onToggleHidden, onToggleSimulated }: RankingRowProps) {
  const share = total > 0 ? Math.round((stat.demand / total) * 100) : 0;
  const barColor =
    isHidden || !hasCv ? "bg-muted-foreground/40"
    : stat.inCv ? "bg-skill-have"
    : stat.simulated ? "bg-skill-have/50"
    : "bg-skill-gap";

  return (
    <li
      className="group grid grid-cols-[1.25rem_minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[1.25rem_minmax(0,13rem)_minmax(0,1fr)_auto_2rem]"
      title={`${stat.name}: la piden ${stat.demand} de ${total} postulaciones (${share}%)`}
    >
      <span className="flex justify-center">
        {hasCv && (stat.inCv ? (
          <>
            <Check className="size-4 text-skill-have" aria-hidden />
            <span className="sr-only">La tenés:</span>
          </>
        ) : (
          // Las que faltan se tildan para simular que el CV las suma
          <>
            <input
              type="checkbox"
              className="size-4 accent-[var(--skill-have)] disabled:opacity-40"
              checked={stat.simulated}
              onChange={onToggleSimulated}
              disabled={isHidden}
              aria-label={`Simular que sumo ${stat.name}`}
              title="Simular que la sumo a mi CV"
            />
            <span className="sr-only">Te falta:</span>
          </>
        ))}
      </span>

      <div className="min-w-0">
        <p className={`truncate font-medium ${isHidden ? "text-muted-foreground line-through" : ""}`}>{stat.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{CATEGORY_LABELS[stat.category]}</span>
          {stat.simulated && (
            <span className="shrink-0 font-medium tabular-nums text-foreground">{formatPoints(stat.points)}</span>
          )}
          {!stat.verified && (
            <Badge
              variant="outline"
              className="shrink-0 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
              title="Todavía no está en el diccionario: puede ser una variante de otra habilidad"
            >
              sin verificar
            </Badge>
          )}
        </div>
      </div>

      {/* En móvil la barra baja a una segunda línea */}
      <div className="col-start-2 col-end-5 row-start-2 h-2 overflow-hidden rounded-[4px] bg-muted sm:col-start-auto sm:col-end-auto sm:row-start-auto">
        <div className={`h-full rounded-r-[4px] ${barColor}`} style={{ width: `${share}%` }} />
      </div>

      <p className="text-right text-sm tabular-nums text-muted-foreground">
        <span className="font-medium text-foreground">{stat.demand}</span> de {total}
      </p>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onToggleHidden}
        aria-label={isHidden ? `Volver a contar ${stat.name}` : `Sacar ${stat.name} del cálculo`}
        className="text-muted-foreground md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
      >
        {isHidden ? <EyeOff /> : <Eye />}
      </Button>
    </li>
  );
}
