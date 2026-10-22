"use client";

import { useState, useMemo } from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowUpDown, Check, ExternalLink, Minus, Trash2, X, Eye } from "lucide-react";
import { ApplicationStatus, JobApplication, useApplicationStore } from "@/store/applicationStore";
import { toast } from "sonner";
import { SENIORITY_LABELS, isSeniority } from "@/lib/positions/rules";
import type { KeywordInsights } from "@/actions/insights-actions";
import { matchByApplication } from "@/lib/stats/keywordAnalysis";
import {
  STATUS_COLOR_CLASS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  isApplicationStatus,
  isStatusFilter,
  type StatusFilter,
} from "@/lib/applications/status";
import { SKIP_REASON_LABELS, isSkipReason } from "@/lib/applications/skipReasons";
import { usePersistentState } from "@/lib/usePersistentState";
import { getApplicationDescription } from "@/actions/application-actions";

// El filtro por estado se recuerda entre visitas
const STATUS_FILTER_KEY = "keywords:historial:estado";

interface ApplicationsTableProps {
  /** Keywords de las postulaciones cruzadas con el CV activo; null mientras cargan. */
  insights: KeywordInsights | null;
}

export function ApplicationsTable({ insights }: ApplicationsTableProps) {
  const { applications, removeApplication, updateApplicationStatus } = useApplicationStore();

  // Sin CV no se puede decir qué tenés: la columna queda vacía
  const matches = useMemo(
    () => (insights?.cvId ? matchByApplication(insights.keywords, insights.byApplication) : null),
    [insights]
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [statusFilter, setStatusFilter] = usePersistentState<StatusFilter>(STATUS_FILTER_KEY, "all", isStatusFilter);
  // El único filtro por columna es el de estado: se deriva del selector
  const columnFilters = useMemo(
    () => (statusFilter === "all" ? [] : [{ id: "status", value: statusFilter }]),
    [statusFilter]
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  // La lista no trae las descripciones: se piden al abrir cada detalle y quedan guardadas acá
  const [descriptions, setDescriptions] = useState<Record<string, string | null>>({});

  const openDetail = (app: JobApplication) => {
    setSelectedApp(app);
    if (app.jobDescription !== undefined || app.id in descriptions) return;
    getApplicationDescription(app.id)
      .then((text) => setDescriptions((current) => ({ ...current, [app.id]: text })))
      .catch(() => {
        toast.error("No se pudo cargar la descripción.");
        setDescriptions((current) => ({ ...current, [app.id]: null }));
      });
  };
  const selectedDescription = selectedApp
    ? selectedApp.jobDescription ?? (selectedApp.id in descriptions ? descriptions[selectedApp.id] ?? "" : undefined)
    : undefined;

  // Cuántas hay de cada estado, para mostrarlo en el selector
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of applications) counts.set(app.status, (counts.get(app.status) ?? 0) + 1);
    return counts;
  }, [applications]);

  const suggestions = useMemo(() => {
    if (!applications) return [];
    const titles = applications.map((a) => a.jobTitle);
    const keywords = applications.flatMap((a) => a.detectedWords || []);
    return Array.from(new Set([...titles, ...keywords])).sort();
  }, [applications]);

  const handleDelete = async (id: string) => {
      if (!window.confirm('¿Eliminar esta postulación? Esto es irreversible')) return;
      try {
          await removeApplication(id);
          toast.success("Postulación eliminada");
      } catch {
          toast.error("No se pudo eliminar la postulación");
      }
  }

  const handleStatusChange = async (id: string, status: ApplicationStatus) => {
    try {
      await updateApplicationStatus(id, status);
      toast.success("Estado actualizado");
    } catch {
      toast.error("No se pudo actualizar el estado");
    }
  };

  const getSafeStatus = (status: string | undefined): ApplicationStatus =>
    isApplicationStatus(status) ? status : "APPLIED";

  const columns: ColumnDef<JobApplication>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Fecha
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <div className="lowercase">{row.getValue("date")}</div>,
    },
    {
      accessorKey: "jobTitle",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Título
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const { role, seniority, jobTitle } = row.original;
        // Si el título ya es el nombre del rol, repetirlo debajo no agrega nada
        const showRole = role && (role.toLowerCase() !== jobTitle.trim().toLowerCase() || isSeniority(seniority));
        return (
          <div>
            <div className="font-medium">{row.getValue("jobTitle")}</div>
            {showRole && (
              <div className="text-xs text-muted-foreground">
                {role}
                {isSeniority(seniority) && `, ${SENIORITY_LABELS[seniority]}`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "match",
      // Sin dato va al final al ordenar de mayor a menor
      accessorFn: (app) => matches?.[app.id]?.ratio ?? -1,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
          >
            Coincidencia
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const match = matches?.[row.original.id];
        if (!match || match.total === 0) {
          const reason = matches
            ? "Esta postulación no tiene habilidades detectadas"
            : "Subí tu CV en Mi perfil para ver la coincidencia";
          return <span className="text-muted-foreground" title={reason}>-</span>;
        }
        return (
          <div className="w-24 space-y-1" title={`Tenés ${match.have} de las ${match.total} habilidades que pide`}>
            <p className="text-sm tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{match.have}</span> de {match.total}
            </p>
            <div className="h-1.5 overflow-hidden rounded-[4px] bg-muted">
              <div className="h-full rounded-r-[4px] bg-skill-have" style={{ width: `${match.ratio * 100}%` }} />
            </div>
          </div>
        );
      },
    },
    {
        id: "description",
        header: "Descripción",
        cell: ({ row }) => {
            return (
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2"
                    onClick={() => openDetail(row.original)}
                >
                    <Eye className="w-4 h-4" /> Ver detalle
                </Button>
            )
        }
    },
    {
      accessorKey: "link",
      header: "Enlace",
      cell: ({ row }) => {
        const link = row.getValue("link") as string;
        if (!link) return <span className="text-muted-foreground">-</span>;
        return (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
          >
            Ver <ExternalLink className="w-3 h-3" />
          </a>
        );
      },
    },
    {
      id: "status",
      accessorKey: "status",
      filterFn: "equals",
      header: () => <div className="text-right">Estado</div>,
      cell: ({ row }) => {
        const app = row.original;
        const currentStatus = getSafeStatus(app.status);
        return (
          <div className="flex justify-end">
            <Select
              value={currentStatus}
              onValueChange={(value) => handleStatusChange(app.id, value as ApplicationStatus)}
            >
              <SelectTrigger className={`w-[140px] ${STATUS_COLOR_CLASS[currentStatus]}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className={STATUS_COLOR_CLASS[option.value]}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const app = row.original;
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive/90"
            onClick={() => handleDelete(app.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  const table = useReactTable({
    data: applications,
    columns,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      const app = row.original as JobApplication;
      const title = app.jobTitle?.toLowerCase() || "";
      const keywords = (app.detectedWords || []).join(" ").toLowerCase();
      return title.includes(search) || keywords.includes(search);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-3 py-4">
        <Input
          placeholder="Filtrar por título o palabra clave..."
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm"
          list="suggestions-list"
        />
        <datalist id="suggestions-list">
          {suggestions.map((item, index) => (
            <option key={index} value={item} />
          ))}
        </datalist>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(isStatusFilter(value) ? value : "all")}>
          <SelectTrigger className="w-[220px]" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados ({applications.length})</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className={STATUS_COLOR_CLASS[option.value]}>
                {option.label} ({statusCounts.get(option.value) ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {statusFilter === "all"
                    ? "No hay resultados."
                    : `No hay postulaciones en estado "${STATUS_LABELS[statusFilter]}".`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} postulaciones encontradas.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>

      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative bg-background shadow-lg">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => setSelectedApp(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle>{selectedApp.jobTitle}</CardTitle>
              <CardDescription>
                Postulado el {selectedApp.date}
                {selectedApp.link && (
                    <a href={selectedApp.link} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center text-blue-500 hover:underline">
                        Ver oferta original <ExternalLink className="ml-1 w-3 h-3" />
                    </a>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(selectedApp.notes || selectedApp.skipReason) && (
                <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-sm">
                  {isSkipReason(selectedApp.skipReason) && (
                    <p>
                      <span className="font-medium">Descartada:</span> {SKIP_REASON_LABELS[selectedApp.skipReason]}
                      {selectedApp.skipDetail && ` (${selectedApp.skipDetail})`}
                    </p>
                  )}
                  {selectedApp.notes && <p className="whitespace-pre-wrap">{selectedApp.notes}</p>}
                </div>
              )}
              <div>
                <h4 className="font-semibold mb-2">Descripción del Puesto</h4>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap" aria-busy={selectedDescription === undefined}>
                  {selectedDescription === undefined ? "Cargando…" : selectedDescription || "Sin descripción disponible."}
                </div>
              </div>
              
              {matches?.[selectedApp.id]?.total ? (
                <div>
                  <h4 className="font-semibold mb-2">
                    Tenés {matches[selectedApp.id].have} de las {matches[selectedApp.id].total} habilidades que pide
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {matches[selectedApp.id].keywords.map((keyword) => (
                      <li key={keyword.id} className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                        {keyword.inCv ? (
                          <Check className="size-3.5 text-skill-have" aria-hidden />
                        ) : (
                          <Minus className="size-3.5 text-skill-gap" aria-hidden />
                        )}
                        <span className="sr-only">{keyword.inCv ? "La tenés:" : "Te falta:"}</span>
                        {keyword.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : selectedApp.detectedWords && selectedApp.detectedWords.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Palabras Clave Detectadas</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedApp.detectedWords.map((word, i) => (
                      <span key={i} className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-medium">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={() => setSelectedApp(null)}>Cerrar</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
