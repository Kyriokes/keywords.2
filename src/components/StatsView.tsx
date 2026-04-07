"use client";

import { useApplicationStore } from "@/store/applicationStore";
import { useCvStore } from "@/store/cvStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getKeywordStats } from "@/lib/stats/keywordAnalysis";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

export function StatsView() {
    const { applications } = useApplicationStore();
    const { cvs, selectCv, fetchCVs } = useCvStore();
    const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [hiddenKeywordNames, setHiddenKeywordNames] = useState<string[]>([]);
    const [matchedPage, setMatchedPage] = useState(1);
    const [missingPage, setMissingPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        fetchCVs();
    }, [fetchCVs]);

    const appliedPositions = useMemo(
        () =>
            Array.from(
                new Set(
                    applications
                        .map((application) => application.positionId?.trim())
                        .filter((position): position is string => Boolean(position))
                )
            ),
        [applications]
    );

    useEffect(() => {
        if (appliedPositions.length === 0) {
            setSelectedPositions((previous) => (previous.length === 0 ? previous : []));
            return;
        }
        setSelectedPositions((previous) => {
            const validPrevious = previous.filter((position) => appliedPositions.includes(position));
            if (validPrevious.length > 0) {
                if (
                    validPrevious.length === previous.length &&
                    validPrevious.every((position, index) => position === previous[index])
                ) {
                    return previous;
                }
                return validPrevious;
            }
            if (
                appliedPositions.length === previous.length &&
                appliedPositions.every((position, index) => position === previous[index])
            ) {
                return previous;
            }
            return appliedPositions;
        });
    }, [appliedPositions]);

    const activeCv = useMemo(() =>
        cvs.find(c => c.isPrimary) || cvs[0] || null,
    [cvs]);

    const cvKeywords = activeCv?.keywords || [];

    const filteredApplications = useMemo(() => {
        if (selectedPositions.length === 0) {
            return applications;
        }
        const selectedSet = new Set(selectedPositions);
        return applications.filter((application) => {
            if (!application.positionId) return false;
            return selectedSet.has(application.positionId);
        });
    }, [applications, selectedPositions]);

    const keywordStats = useMemo(
        () => getKeywordStats(filteredApplications, cvKeywords),
        [filteredApplications, cvKeywords]
    );

    useEffect(() => {
        setHiddenKeywordNames((previous) => {
            const next = previous.filter((name) =>
                keywordStats.some((keyword) => keyword.normalizedName === name)
            );
            if (next.length === previous.length && next.every((name, index) => name === previous[index])) {
                return previous;
            }
            return next;
        });
    }, [keywordStats]);

    const visibleKeywordStats = useMemo(
        () => keywordStats.filter((keyword) => !hiddenKeywordNames.includes(keyword.normalizedName)),
        [keywordStats, hiddenKeywordNames]
    );

    const matchPercentage = useMemo(() => {
        if (visibleKeywordStats.length === 0) return 0;
        const matches = visibleKeywordStats.filter((keyword) => keyword.inCv).length;
        return Math.round((matches / visibleKeywordStats.length) * 100);
    }, [visibleKeywordStats]);

    const matchedKeywords = useMemo(
        () => keywordStats.filter((keyword) => keyword.inCv),
        [keywordStats]
    );

    const missingKeywords = useMemo(
        () => keywordStats.filter((keyword) => !keyword.inCv),
        [keywordStats]
    );

    const totalMatchedPages = useMemo(
        () => Math.max(1, Math.ceil(matchedKeywords.length / rowsPerPage)),
        [matchedKeywords.length, rowsPerPage]
    );

    const totalMissingPages = useMemo(
        () => Math.max(1, Math.ceil(missingKeywords.length / rowsPerPage)),
        [missingKeywords.length, rowsPerPage]
    );

    useEffect(() => {
        if (matchedPage > totalMatchedPages) {
            setMatchedPage(totalMatchedPages);
        }
    }, [matchedPage, totalMatchedPages]);

    useEffect(() => {
        if (missingPage > totalMissingPages) {
            setMissingPage(totalMissingPages);
        }
    }, [missingPage, totalMissingPages]);

    const paginatedMatchedKeywords = useMemo(() => {
        const start = (matchedPage - 1) * rowsPerPage;
        return matchedKeywords.slice(start, start + rowsPerPage);
    }, [matchedKeywords, matchedPage, rowsPerPage]);

    const paginatedMissingKeywords = useMemo(() => {
        const start = (missingPage - 1) * rowsPerPage;
        return missingKeywords.slice(start, start + rowsPerPage);
    }, [missingKeywords, missingPage, rowsPerPage]);

    const matchedEmptyRows = useMemo(
        () => Math.max(0, rowsPerPage - paginatedMatchedKeywords.length),
        [rowsPerPage, paginatedMatchedKeywords.length]
    );

    const missingEmptyRows = useMemo(
        () => Math.max(0, rowsPerPage - paginatedMissingKeywords.length),
        [rowsPerPage, paginatedMissingKeywords.length]
    );

    const togglePosition = (position: string) => {
        setSelectedPositions((previous) => {
            if (previous.includes(position)) {
                if (previous.length === 1) return previous;
                return previous.filter((item) => item !== position);
            }
            return [...previous, position];
        });
    };

    const toggleKeywordVisibility = (normalizedName: string) => {
        setHiddenKeywordNames((previous) => {
            if (previous.includes(normalizedName)) {
                return previous.filter((name) => name !== normalizedName);
            }
            return [...previous, normalizedName];
        });
    };

    const getTableNames = (table: "matched" | "missing") =>
        (table === "matched" ? matchedKeywords : missingKeywords).map((keyword) => keyword.normalizedName);

    const showTableKeywords = (table: "matched" | "missing") => {
        const tableNames = new Set(getTableNames(table));
        setHiddenKeywordNames((previous) => previous.filter((name) => !tableNames.has(name)));
    };

    const hideTableKeywords = (table: "matched" | "missing") => {
        const tableNames = getTableNames(table);
        setHiddenKeywordNames((previous) => Array.from(new Set([...previous, ...tableNames])));
    };

    const resetTable = (table: "matched" | "missing") => {
        showTableKeywords(table);
        if (table === "matched") {
            setMatchedPage(1);
            return;
        }
        setMissingPage(1);
    };

    const resetAllVisibility = () => {
        setHiddenKeywordNames([]);
    };

    const hiddenMatchedCount = useMemo(
        () => matchedKeywords.filter((keyword) => hiddenKeywordNames.includes(keyword.normalizedName)).length,
        [matchedKeywords, hiddenKeywordNames]
    );

    const hiddenMissingCount = useMemo(
        () => missingKeywords.filter((keyword) => hiddenKeywordNames.includes(keyword.normalizedName)).length,
        [missingKeywords, hiddenKeywordNames]
    );

    return (
        <div className="space-y-6">
            <div className="bg-card rounded-lg border shadow-sm">
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium whitespace-nowrap">Analizar según CV:</span>
                        <Select value={activeCv?.id} onValueChange={selectCv}>
                            <SelectTrigger className="w-[260px]" disabled={cvs.length === 0}>
                                <SelectValue placeholder={cvs.length === 0 ? "No hay CVs cargados" : "Selecciona un CV"} />
                            </SelectTrigger>
                            <SelectContent>
                                {cvs.map(cv => (
                                    <SelectItem key={cv.id} value={cv.id}>
                                        {cv.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {activeCv && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(activeCv.uploadDate).toLocaleDateString()}
                            </span>
                        )}
                        <div className="h-9 min-w-[96px] rounded-md border px-3 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">Puestos</span>
                            <span className="text-xs font-medium">{selectedPositions.length}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsFiltersOpen((previous) => !previous)}
                            className="h-9 px-3 rounded-md border text-sm inline-flex items-center gap-2"
                        >
                            <span>Filtros de puestos</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isFiltersOpen ? "rotate-180" : ""}`} />
                        </button>
                        <button
                            type="button"
                            onClick={resetAllVisibility}
                            className="h-9 px-3 rounded-md border text-sm disabled:opacity-50"
                            disabled={hiddenKeywordNames.length === 0}
                        >
                            Reiniciar todo
                        </button>
                    </div>
                    {!activeCv && (
                        <span className="text-xs text-muted-foreground basis-full">
                            Carga un CV en Mi Perfil para activar la comparación de keywords.
                        </span>
                    )}
                </div>
                {isFiltersOpen && (
                    <div className="px-4 pb-4 pt-1 border-t space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Filtrar por puestos postulados:</p>
                            {appliedPositions.length > 0 ? (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        {appliedPositions.map((position) => {
                                            const checked = selectedPositions.includes(position);
                                            return (
                                                <label
                                                    key={position}
                                                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                                                        checked
                                                            ? "border-primary text-foreground"
                                                            : "border-border text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 accent-primary"
                                                        checked={checked}
                                                        onChange={() => togglePosition(position)}
                                                    />
                                                    <span>{position}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Selecciona uno o varios puestos. Debe quedar al menos uno marcado.
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    No hay puestos asociados a tus postulaciones todavía.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="col-span-1 md:col-span-2">
                    <CardHeader>
                        <CardTitle>Palabras Clave Demandadas</CardTitle>
                        <CardDescription>
                            Se muestran en dos columnas según {activeCv ? `"${activeCv.name}"` : "tu CV"} y los puestos seleccionados.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {keywordStats.length > 0 ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                                    <div className="space-y-3 flex flex-col">
                                        <h3 className="text-sm font-semibold text-green-600">Las que tenés</h3>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => showTableKeywords("matched")}
                                                className="h-8 px-2.5 rounded-md border text-xs disabled:opacity-50"
                                                disabled={hiddenMatchedCount === 0}
                                            >
                                                Mostrar todo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => hideTableKeywords("matched")}
                                                className="h-8 px-2.5 rounded-md border text-xs disabled:opacity-50"
                                                disabled={matchedKeywords.length === 0 || hiddenMatchedCount === matchedKeywords.length}
                                            >
                                                Ocultar todo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => resetTable("matched")}
                                                className="h-8 px-2.5 rounded-md border text-xs disabled:opacity-50"
                                                disabled={hiddenMatchedCount === 0 && matchedPage === 1}
                                            >
                                                Reiniciar tabla
                                            </button>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                Ocultas: {hiddenMatchedCount} / Total: {matchedKeywords.length}
                                            </span>
                                        </div>
                                        {matchedKeywords.length > 0 ? (
                                            <div className="space-y-2 flex flex-col flex-1">
                                                <div className="rounded-md border overflow-hidden">
                                                    <div className="grid grid-cols-[1fr_90px_44px] items-center px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
                                                        <p>Habilidad detectada</p>
                                                        <p className="text-right">Frecuencia</p>
                                                        <p className="text-center">Ver</p>
                                                    </div>
                                                    {paginatedMatchedKeywords.map((keyword) => (
                                                        <div key={keyword.normalizedName} className="grid grid-cols-[1fr_90px_44px] items-center gap-3 px-3 py-2 border-b last:border-b-0">
                                                            <p className={`font-medium truncate ${hiddenKeywordNames.includes(keyword.normalizedName) ? "text-muted-foreground line-through" : ""}`}>{keyword.name}</p>
                                                            <p className="text-sm text-right tabular-nums text-muted-foreground">{keyword.value}</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleKeywordVisibility(keyword.normalizedName)}
                                                                className="h-8 w-8 rounded-md border flex items-center justify-center justify-self-center"
                                                            >
                                                                {hiddenKeywordNames.includes(keyword.normalizedName) ? (
                                                                    <EyeOff className="h-4 w-4 text-red-500" />
                                                                ) : (
                                                                    <Eye className="h-4 w-4 text-gray-500" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {Array.from({ length: matchedEmptyRows }).map((_, index) => (
                                                        <div key={`matched-empty-${index}`} className="grid grid-cols-[1fr_90px_44px] items-center gap-3 px-3 py-2 border-b last:border-b-0">
                                                            <p className="text-transparent select-none">.</p>
                                                            <p className="text-transparent select-none text-right">.</p>
                                                            <div className="h-8 w-8 justify-self-center" />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-center gap-2 mt-auto">
                                                    <span className="text-xs text-muted-foreground">Página</span>
                                                    <button
                                                        type="button"
                                                        className="h-8 px-3 rounded-md border text-sm disabled:opacity-50"
                                                        onClick={() => setMatchedPage((previous) => Math.max(1, previous - 1))}
                                                        disabled={matchedPage === 1}
                                                    >
                                                        {"<"}
                                                    </button>
                                                    <p className="text-xs text-muted-foreground">
                                                        {matchedPage} de {totalMatchedPages}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="h-8 px-3 rounded-md border text-sm disabled:opacity-50"
                                                        onClick={() => setMatchedPage((previous) => Math.min(totalMatchedPages, previous + 1))}
                                                        disabled={matchedPage === totalMatchedPages}
                                                    >
                                                        {">"}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No hay coincidencias para este filtro.</p>
                                        )}
                                    </div>
                                    <div className="space-y-3 flex flex-col">
                                        <h3 className="text-sm font-semibold text-orange-600">Las que no</h3>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => showTableKeywords("missing")}
                                                className="h-8 px-2.5 rounded-md border text-xs disabled:opacity-50"
                                                disabled={hiddenMissingCount === 0}
                                            >
                                                Mostrar todo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => hideTableKeywords("missing")}
                                                className="h-8 px-2.5 rounded-md border text-xs disabled:opacity-50"
                                                disabled={missingKeywords.length === 0 || hiddenMissingCount === missingKeywords.length}
                                            >
                                                Ocultar todo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => resetTable("missing")}
                                                className="h-8 px-2.5 rounded-md border text-xs disabled:opacity-50"
                                                disabled={hiddenMissingCount === 0 && missingPage === 1}
                                            >
                                                Reiniciar tabla
                                            </button>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                Ocultas: {hiddenMissingCount} / Total: {missingKeywords.length}
                                            </span>
                                        </div>
                                        {missingKeywords.length > 0 ? (
                                            <div className="space-y-2 flex flex-col flex-1">
                                                <div className="rounded-md border overflow-hidden">
                                                    <div className="grid grid-cols-[1fr_90px_44px] items-center px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
                                                        <p>Habilidad detectada</p>
                                                        <p className="text-right">Frecuencia</p>
                                                        <p className="text-center">Ver</p>
                                                    </div>
                                                    {paginatedMissingKeywords.map((keyword) => (
                                                        <div key={keyword.normalizedName} className="grid grid-cols-[1fr_90px_44px] items-center gap-3 px-3 py-2 border-b last:border-b-0">
                                                            <p className={`font-medium truncate ${hiddenKeywordNames.includes(keyword.normalizedName) ? "text-muted-foreground line-through" : ""}`}>{keyword.name}</p>
                                                            <p className="text-sm text-right tabular-nums text-muted-foreground">{keyword.value}</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleKeywordVisibility(keyword.normalizedName)}
                                                                className="h-8 w-8 rounded-md border flex items-center justify-center justify-self-center"
                                                            >
                                                                {hiddenKeywordNames.includes(keyword.normalizedName) ? (
                                                                    <EyeOff className="h-4 w-4 text-red-500" />
                                                                ) : (
                                                                    <Eye className="h-4 w-4 text-gray-500" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {Array.from({ length: missingEmptyRows }).map((_, index) => (
                                                        <div key={`missing-empty-${index}`} className="grid grid-cols-[1fr_90px_44px] items-center gap-3 px-3 py-2 border-b last:border-b-0">
                                                            <p className="text-transparent select-none">.</p>
                                                            <p className="text-transparent select-none text-right">.</p>
                                                            <div className="h-8 w-8 justify-self-center" />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-center gap-2 mt-auto">
                                                    <span className="text-xs text-muted-foreground">Página</span>
                                                    <button
                                                        type="button"
                                                        className="h-8 px-3 rounded-md border text-sm disabled:opacity-50"
                                                        onClick={() => setMissingPage((previous) => Math.max(1, previous - 1))}
                                                        disabled={missingPage === 1}
                                                    >
                                                        {"<"}
                                                    </button>
                                                    <p className="text-xs text-muted-foreground">
                                                        {missingPage} de {totalMissingPages}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="h-8 px-3 rounded-md border text-sm disabled:opacity-50"
                                                        onClick={() => setMissingPage((previous) => Math.min(totalMissingPages, previous + 1))}
                                                        disabled={missingPage === totalMissingPages}
                                                    >
                                                        {">"}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">Excelente: no hay faltantes relevantes con este filtro.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 justify-end mt-4">
                                    <span className="text-sm font-medium">Filas por página:</span>
                                    <Select value={String(rowsPerPage)} onValueChange={(value) => setRowsPerPage(Number(value))}>
                                        <SelectTrigger className="w-[90px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5</SelectItem>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="15">15</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                No hay suficientes datos para generar estadísticas.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Alineación con el Mercado</CardTitle>
                        <CardDescription>
                            Basado en las habilidades requeridas para los puestos seleccionados vs {activeCv ? activeCv.name : "tu CV"}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center py-6">
                        <div className="text-center">
                            <span className="text-6xl font-bold text-primary">{matchPercentage}%</span>
                            <p className="text-sm text-muted-foreground mt-2">
                                De las habilidades visibles en este filtro están en tu CV.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Se excluyen {hiddenKeywordNames.length} habilidades ocultas manualmente.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Actividad Reciente</CardTitle>
                        <CardDescription>
                            Volumen de postulaciones del filtro actual
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center py-6">
                        <div className="text-center space-y-2">
                            <p className="text-4xl font-bold">{filteredApplications.length}</p>
                            <p className="text-sm text-muted-foreground">Postulaciones analizadas</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
