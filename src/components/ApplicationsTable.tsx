"use client";

import { useState, useMemo } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
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
import { ArrowUpDown, ExternalLink, Trash2, X, Eye } from "lucide-react";
import { ApplicationStatus, JobApplication, useApplicationStore } from "@/store/applicationStore";
import { toast } from "sonner";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "APPLIED", label: "Enviada" },
  { value: "INTERVIEW", label: "Entrevista" },
  { value: "SAVED", label: "Guardada" },
  { value: "REJECTED", label: "Rechazada" },
];

const VALID_STATUS_VALUES = new Set<ApplicationStatus>(STATUS_OPTIONS.map((option) => option.value));
const STATUS_COLOR_CLASS: Record<ApplicationStatus, string> = {
  APPLIED: "text-primary",
  INTERVIEW: "text-amber-600",
  SAVED: "text-muted-foreground",
  REJECTED: "text-red-600",
};

export function ApplicationsTable() {
  const { applications, removeApplication, updateApplicationStatus } = useApplicationStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

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
    VALID_STATUS_VALUES.has(status as ApplicationStatus) ? (status as ApplicationStatus) : "APPLIED";

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
      cell: ({ row }) => <div className="font-medium">{row.getValue("jobTitle")}</div>,
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
                    onClick={() => setSelectedApp(row.original)}
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
    onColumnFiltersChange: setColumnFilters,
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
      <div className="flex items-center py-4">
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
                  No hay resultados.
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
              <div>
                <h4 className="font-semibold mb-2">Descripción del Puesto</h4>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedApp.jobDescription || "Sin descripción disponible."}
                </div>
              </div>
              
              {selectedApp.detectedWords && selectedApp.detectedWords.length > 0 && (
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
