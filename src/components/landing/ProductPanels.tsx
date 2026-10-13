import { ArrowRightIcon, CheckIcon, MinusIcon } from "@phosphor-icons/react/dist/ssr";
import { formatPoints } from "@/components/stats/format";
import { SENIORITY_LABELS } from "@/lib/positions/rules";
import { cn } from "@/lib/utils";
import {
  SAMPLE_APPLICATIONS,
  SAMPLE_INPUT,
  SAMPLE_MATCHES,
  SAMPLE_OFFER,
  SAMPLE_SUMMARY,
  type SampleApplication,
} from "./sample-data";
import { summarizeKeywords } from "@/lib/stats/keywordAnalysis";
import { productFrame, productSurface } from "./styles";

// Fragmentos de la interfaz del producto, armados con los datos de ejemplo. Son estáticos:
// muestran cómo se ve cada pantalla, no reemplazan a los componentes de la app.

const roleLine = ({ role, seniority }: SampleApplication) =>
  seniority ? `${role}, ${SENIORITY_LABELS[seniority]}` : role;

function Frame({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(productFrame, "h-full")}>
      <div className={cn(productSurface, "flex h-full flex-col gap-4 p-6", className)}>
        <p className="text-sm text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

function MatchBar({ have, total }: { have: number; total: number }) {
  return (
    <div className="w-24 shrink-0 space-y-1">
      <p className="text-sm tabular-nums text-muted-foreground">
        <span className="font-medium text-foreground">{have}</span> de {total}
      </p>
      <div className="h-2 overflow-hidden rounded-sm bg-muted">
        <div className="h-full rounded-r-sm bg-skill-have" style={{ width: `${(have / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** Parte el texto de la oferta en tramos, marcando lo que detectó el diccionario. */
function highlight(text: string, written: string[]) {
  const parts: Array<{ text: string; detected: boolean }> = [];
  let cursor = 0;

  for (const term of written) {
    const at = text.indexOf(term, cursor);
    if (at < 0) continue;
    if (at > cursor) parts.push({ text: text.slice(cursor, at), detected: false });
    parts.push({ text: term, detected: true });
    cursor = at + term.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), detected: false });

  return parts;
}

/** Paso 1: la oferta pegada y cómo queda guardada. */
export function OfferPanel() {
  const parts = highlight(SAMPLE_OFFER.text, SAMPLE_OFFER.detected.map((item) => item.written));

  return (
    <Frame label="La oferta, tal como la pegaste">
      <div className="flex flex-col gap-2">
        <p className="font-medium">{SAMPLE_OFFER.title}</p>
        <p className="text-sm text-pretty text-muted-foreground">
          {parts.map((part, index) =>
            part.detected ? (
              <mark key={index} className="rounded-sm bg-muted px-1 font-medium text-foreground">
                {part.text}
              </mark>
            ) : (
              part.text
            )
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Cómo queda guardada</p>
        <p className="font-medium">{roleLine(SAMPLE_APPLICATIONS[0])}</p>
        <ul className="flex flex-wrap gap-2">
          {SAMPLE_OFFER.detected.map((item) => (
            <li key={item.name} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
              {item.written !== item.name && (
                <>
                  <span className="text-muted-foreground">{item.written}</span>
                  <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden />
                  <span className="sr-only">se guarda como</span>
                </>
              )}
              <span className="font-medium">{item.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

// Cinco postulaciones con coincidencias bien distintas, para que se vea el rango
const MATCH_ROWS = [0, 3, 5, 10, 12].map((index) => SAMPLE_APPLICATIONS[index]);

/** Paso 2: cuánto de cada postulación ya está en el CV. */
export function MatchPanel() {
  return (
    <Frame label="Coincidencia con tu CV">
      <ul className="divide-y">
        {MATCH_ROWS.map((application) => (
          <li key={application.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{application.title}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLine(application)}</p>
            </div>
            <MatchBar have={SAMPLE_MATCHES[application.id].have} total={SAMPLE_MATCHES[application.id].total} />
          </li>
        ))}
      </ul>
    </Frame>
  );
}

const RANKING_ROWS = SAMPLE_SUMMARY.stats.slice(0, 9);

/** Paso 3: las habilidades ordenadas por demanda. */
export function RankingPanel() {
  const total = SAMPLE_SUMMARY.totalApplications;

  return (
    <Frame label="Lo que más te piden">
      <ul className="flex flex-col gap-3">
        {RANKING_ROWS.map((stat) => (
          <li key={stat.id} className="grid grid-cols-[1rem_minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3">
            {stat.inCv ? (
              <CheckIcon weight="bold" className="size-4 text-skill-have" aria-hidden />
            ) : (
              <MinusIcon weight="bold" className="size-4 text-skill-gap" aria-hidden />
            )}
            <span className="truncate font-medium">
              <span className="sr-only">{stat.inCv ? "La tenés: " : "Te falta: "}</span>
              {stat.name}
            </span>
            <div className="h-2 overflow-hidden rounded-sm bg-muted">
              <div
                className={cn("h-full rounded-r-sm", stat.inCv ? "bg-skill-have" : "bg-skill-gap")}
                style={{ width: `${(stat.demand / total) * 100}%` }}
              />
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{stat.demand}</span> de {total}
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** Beneficio: las tres faltantes que más cobertura suman. */
export function GapsFragment() {
  return (
    <Frame label="Qué sumar primero">
      <ul className="divide-y">
        {SAMPLE_SUMMARY.gaps.slice(0, 3).map((gap) => (
          <li key={gap.id} className="flex items-center justify-between gap-4 py-3">
            <span className="font-medium">{gap.name}</span>
            <span className="font-mono text-sm tabular-nums">{formatPoints(gap.points)}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** Beneficio: una postulación con cada habilidad marcada como tenés o te falta. */
export function MatchFragment() {
  const application = SAMPLE_APPLICATIONS[1];
  const match = SAMPLE_MATCHES[application.id];

  return (
    <Frame label="Una postulación">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{application.title}</p>
          <p className="truncate text-xs text-muted-foreground">{roleLine(application)}</p>
        </div>
        <MatchBar have={match.have} total={match.total} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {[...match.keywords].reverse().map((keyword) => (
          <li key={keyword.id} className="inline-flex items-center gap-1">
            {keyword.inCv ? (
              <CheckIcon weight="bold" className="size-4 text-skill-have" aria-hidden />
            ) : (
              <MinusIcon weight="bold" className="size-4 text-skill-gap" aria-hidden />
            )}
            <span className="sr-only">{keyword.inCv ? "La tenés: " : "Te falta: "}</span>
            {keyword.name}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

const FRONTEND = SAMPLE_APPLICATIONS[0].role;
const FRONTEND_TITLES = SAMPLE_APPLICATIONS.filter((item) => item.role === FRONTEND).slice(0, 4);

/** Beneficio: varios títulos distintos que caen en el mismo rol. */
export function RolesFragment() {
  return (
    <Frame label="Cuatro títulos, un rol">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4">
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {FRONTEND_TITLES.map((application) => (
            <li key={application.id} className="truncate">
              {application.title}
            </li>
          ))}
        </ul>
        <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
        <p className="rounded-full border px-3 py-1 text-sm font-medium">
          <span className="sr-only">se agrupan como </span>
          {FRONTEND}
        </p>
      </div>
    </Frame>
  );
}

const TOP_GAP = SAMPLE_SUMMARY.gaps[0];
const SIMULATED = summarizeKeywords({ ...SAMPLE_INPUT, simulatedIds: new Set([TOP_GAP.id]) });

/** Beneficio: la cobertura antes y después de tildar la primera faltante. */
export function SimulationFragment() {
  const { coverage, simulatedCoverage } = SIMULATED;
  const segments = [
    { key: "have", width: coverage, className: "bg-skill-have" },
    { key: "simulated", width: simulatedCoverage - coverage, className: "bg-skill-have/50" },
    { key: "gap", width: 100 - simulatedCoverage, className: "bg-skill-gap" },
  ];

  return (
    <Frame label={`Si sumaras ${TOP_GAP.name}`}>
      <p className="flex items-center gap-3 font-mono text-3xl font-semibold tabular-nums">
        <span className="text-muted-foreground">{coverage}%</span>
        <ArrowRightIcon className="size-6 text-muted-foreground" aria-hidden />
        <span className="sr-only">pasa a</span>
        <span>{simulatedCoverage}%</span>
      </p>
      <div
        className="flex h-3 gap-0.5"
        role="img"
        aria-label={`Tenés el ${coverage}% de lo pedido; con ${TOP_GAP.name} llegarías al ${simulatedCoverage}%`}
      >
        {segments.map((segment, index) => (
          <div
            key={segment.key}
            className={cn(
              segment.className,
              index === 0 && "rounded-l-full",
              index === segments.length - 1 && "rounded-r-full"
            )}
            style={{ width: `${segment.width}%` }}
          />
        ))}
      </div>
    </Frame>
  );
}
