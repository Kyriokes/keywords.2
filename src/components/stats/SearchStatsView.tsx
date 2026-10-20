import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SearchStats } from "@/lib/stats/searchStatsQuery";

const TRIGGER_LABELS: Record<string, string> = { CRON: "Cron", MANUAL: "Buscar ahora", AGENT: "Claude" };

// El servidor corre en UTC: la hora se muestra en la de Buenos Aires, como el cron de las 8
const dateFormat = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

const ORIGIN_PARTS: [string, string][] = [
  ["TEMPLATE", "de plantilla"],
  ["ADAPTED", "adaptadas"],
  ["NEW", "nuevas del usuario"],
  ["AGENT", "escritas por Claude"],
  ["SIN_DATO", "sin dato"],
];

const MAX_TEMPLATES = 10;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Barra horizontal proporcional, como las del ranking de habilidades. */
function Bar({ share }: { share: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-[4px] bg-muted">
      <div className="h-full rounded-r-[4px] bg-skill-have" style={{ width: `${Math.min(100, Math.max(0, share))}%` }} />
    </div>
  );
}

export function SearchStatsView({ stats }: { stats: SearchStats }) {
  const { funnel } = stats;
  const funnelCells: [string, number][] = [
    ["Ofertas nuevas", funnel.offers],
    ["De tus puestos", funnel.ofMyRoles],
    ["Pasan los filtros", funnel.passedFilters],
    ["En cola", funnel.queued],
    ["Aprobadas", funnel.approved],
    ["Enviadas", funnel.applied],
    ["Entrevistas", funnel.interviews],
  ];
  const maxReason = Math.max(1, ...stats.reasons.map((reason) => reason.count));
  const usedTemplates = stats.answers.templates.filter((template) => template.used > 0).slice(0, MAX_TEMPLATES);
  const originSummary = ORIGIN_PARTS.filter(([origin]) => stats.answers.byOrigin[origin])
    .map(([origin, label]) => `${stats.answers.byOrigin[origin]} ${label}`)
    .join(", ");

  return (
    <div className="space-y-10">
      <Section title="Embudo">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {funnelCells.map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3">
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Portales">
        {stats.sources.length === 0 ? (
          <Empty>Ningún portal trajo ofertas en el período.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Portal</TableHead>
                <TableHead className="text-right">Ofertas</TableHead>
                <TableHead className="text-right">De tus puestos</TableHead>
                <TableHead className="text-right">Pasan</TableHead>
                <TableHead className="text-right">En cola</TableHead>
                <TableHead className="text-right">Enviadas</TableHead>
                <TableHead className="text-right">Entrevistas</TableHead>
                <TableHead className="min-w-32">Aprovechamiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.sources.map((source) => (
                <TableRow key={source.source}>
                  <TableCell className="space-y-1">
                    <p className="font-medium">{source.label}</p>
                    {source.lastError && (
                      <Badge variant="secondary" className="font-normal">
                        Falló la última vez: {source.lastError}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{source.offers}</TableCell>
                  <TableCell className="text-right tabular-nums">{source.ofMyRoles}</TableCell>
                  <TableCell className="text-right tabular-nums">{source.passed}</TableCell>
                  <TableCell className="text-right tabular-nums">{source.queued}</TableCell>
                  <TableCell className="text-right tabular-nums">{source.applied}</TableCell>
                  <TableCell className="text-right tabular-nums">{source.interviews}</TableCell>
                  <TableCell>
                    {source.yield === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Bar share={source.yield} />
                        <span className="w-10 text-right text-sm tabular-nums">{source.yield}%</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Por qué se descartan">
        {stats.reasons.length === 0 ? (
          <Empty>Los filtros no descartaron ofertas de tus puestos en el período.</Empty>
        ) : (
          <ul className="space-y-2">
            {stats.reasons.map((reason) => (
              <li key={reason.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[16rem_1fr_auto]">
                <span className="text-sm">{reason.label}</span>
                <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                  <Bar share={(reason.count / maxReason) * 100} />
                </div>
                <span className="col-start-2 row-start-1 text-right text-sm tabular-nums sm:col-start-auto">{reason.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Empresas que más publican">
        {stats.companies.length === 0 ? (
          <Empty>Todavía no hay ofertas de tus puestos con empresa en el período.</Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Ofertas</TableHead>
                  <TableHead className="text-right">Pasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.companies.map((company) => (
                  <TableRow key={company.company}>
                    <TableCell>
                      <span className="font-medium">{company.company}</span>
                      {company.board && (
                        <Badge variant="outline" className="ml-2 font-normal">
                          {company.board}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{company.offers}</TableCell>
                    <TableCell className="text-right tabular-nums">{company.passed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {stats.companies.some((company) => company.board) && (
              <p className="text-sm text-muted-foreground">
                Las que muestran un board las podés seguir en la cola → Empresas a seguir.
              </p>
            )}
          </>
        )}
      </Section>

      <Section title="Roles que publican los portales">
        {stats.roles.length === 0 ? (
          <Empty>Todavía no llegaron ofertas en el período.</Empty>
        ) : (
          <ul className="divide-y rounded-lg border">
            {stats.roles.map((role) => (
              <li key={role.role} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{role.role}</span>
                  {role.desired ? (
                    <Badge variant="secondary" className="font-normal">
                      lo seguís
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">no está en tus puestos</span>
                  )}
                </span>
                <span className="tabular-nums">{role.offers}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Últimas búsquedas">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Llegaron</TableHead>
              <TableHead className="text-right">Nuevas</TableHead>
              <TableHead className="text-right">En cola</TableHead>
              <TableHead className="text-right">Para la próxima</TableHead>
              <TableHead className="text-right">Duración (s)</TableHead>
              <TableHead>Errores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.runs.map((run) => (
              <TableRow key={run.startedAt}>
                <TableCell className="whitespace-nowrap">{dateFormat.format(new Date(run.startedAt))}</TableCell>
                <TableCell>{TRIGGER_LABELS[run.trigger] ?? run.trigger}</TableCell>
                <TableCell className="text-right tabular-nums">{run.fetched}</TableCell>
                <TableCell className="text-right tabular-nums">{run.fresh}</TableCell>
                <TableCell className="text-right tabular-nums">{run.created}</TableCell>
                <TableCell className="text-right tabular-nums">{run.deferred}</TableCell>
                <TableCell className="text-right tabular-nums">{Math.round(run.durationMs / 1000)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{run.errors.join(" · ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Respuestas">
        {stats.answers.total === 0 ? (
          <Empty>Todavía no se enviaron formularios en el período.</Empty>
        ) : (
          <div className="space-y-6">
            <p className="text-sm">
              {stats.answers.total} respuestas en el período{originSummary ? `: ${originSummary}` : ""}.
            </p>

            <div className="space-y-2">
              <h3 className="font-medium">Plantillas más usadas</h3>
              {usedTemplates.length === 0 ? (
                <Empty>Ninguna plantilla se usó en el período.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pregunta</TableHead>
                      <TableHead className="text-right">Usada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usedTemplates.map((template) => (
                      <TableRow key={template.templateId}>
                        <TableCell>{template.question}</TableCell>
                        <TableCell className="text-right tabular-nums">{template.used}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Preguntas que se repiten y no tienen plantilla</h3>
              {stats.answers.repeatedWithoutTemplate.length === 0 ? (
                <Empty>Ninguna por ahora.</Empty>
              ) : (
                <>
                  <ul className="divide-y rounded-lg border">
                    {stats.answers.repeatedWithoutTemplate.map((question) => (
                      <li key={question.question} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                        <span>{question.question}</span>
                        <span className="tabular-nums">{question.count}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/user/templates" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    Crear plantilla
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
