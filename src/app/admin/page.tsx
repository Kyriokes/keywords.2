"use client";

import { useCvStore } from "@/store/cvStore";
import { useApplicationStore } from "@/store/applicationStore";
import { usePositionStore } from "@/store/PositionStore";
import { useStatsStore } from "@/store/statsStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, Trash2, RefreshCw, Activity, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import type { ProviderState } from "@/lib/ia/providerManager";
import { PROVIDER_IDS } from "@/lib/ia/providers/ids";
import { PingResponse, SystemBackup } from "@/types/admin";
import { DictionaryQueue } from "@/components/admin/DictionaryQueue";

export default function DebugPage() {
  const { cvs, fetchCVs } = useCvStore();
  const { applications, clearAllApplications, fetchApplications } = useApplicationStore();
  const { positions, clearPositions, setPositions, fetchPositions } = usePositionStore();
  const { providerStats, importStats } = useStatsStore();
  
  const [backendStats, setBackendStats] = useState<Record<string, ProviderState>>({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [pingResults, setPingResults] = useState<Record<string, { status: 'ok' | 'error' | 'loading', latency?: number }>>({});

  const fetchBackendStats = async () => {
      setLoadingStats(true);
      try {
          const res = await fetch('/api/debug/providers');
          if (!res.ok) throw new Error('Error al obtener estadísticas');
          const data = (await res.json()) as Record<string, ProviderState>;
          setBackendStats(data);
      } catch (e: unknown) {
          console.error(e);
          toast.error("Error al cargar estado del backend");
      } finally {
          setLoadingStats(false);
      }
  };

  const refreshAllData = async () => {
      await Promise.all([
          fetchBackendStats(),
          fetchApplications(),
          fetchCVs(),
          fetchPositions()
      ]);
      toast.success("Datos actualizados desde la BD");
  };

  const handlePing = async (providerId: string) => {
    setPingResults(prev => ({ ...prev, [providerId]: { status: 'loading' } }));
    try {
        const res = await fetch(`/api/admin/ping?provider=${providerId}`);
        const data = (await res.json()) as PingResponse;
        
        if (res.ok && data.status === 'ok') {
            setPingResults(prev => ({ ...prev, [providerId]: { status: 'ok', latency: data.latency } }));
            toast.success(`Ping a ${providerId} exitoso (${data.latency}ms)`);
        } else {
            setPingResults(prev => ({ ...prev, [providerId]: { status: 'error' } }));
            toast.error(data.error || `Error al conectar con ${providerId}`);
        }
    } catch (e: unknown) {
        setPingResults(prev => ({ ...prev, [providerId]: { status: 'error' } }));
        toast.error(`Error de red al contactar ${providerId}`);
    }
  };

  useEffect(() => {
      refreshAllData();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = () => {
    const backup = {
        applications: useApplicationStore.getState().applications,
        cvs: useCvStore.getState().cvs,
        positions: usePositionStore.getState().positions,
        stats: useStatsStore.getState().providerStats,
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobtracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.success("Backup descargado");
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        if (!ev.target?.result) return;
        try {
            const data = JSON.parse(ev.target.result as string) as SystemBackup;
            if (confirm("Esto sobrescribirá todos los datos actuales (CVs, Postulaciones, Estadísticas). ¿Estás seguro?")) {
                // if (data.applications) setApplications(data.applications);
                // if (data.cvs) setCvs(data.cvs);
                if (data.positions && Array.isArray(data.positions)) setPositions(data.positions);
                if (data.stats) importStats(data.stats);
                toast.success("Backup restaurado correctamente");
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch(err: unknown) {
            console.error(err);
            toast.error("Error al leer el archivo de backup.");
        }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="container mx-auto p-6 space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        
        <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadBackup}>
                <Download className="mr-2 h-4 w-4" /> Exportar Datos
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Restaurar Datos
            </Button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleRestoreBackup}
            />
            
            <div className="w-px h-8 bg-border mx-2 hidden md:block"></div>

            <Button variant="destructive" onClick={() => {
                if(confirm("¿Seguro que quieres borrar TODAS las postulaciones?")) clearAllApplications();
            }}>
                <Trash2 className="mr-2 h-4 w-4" />
                Borrar Postulaciones
            </Button>
            <Button variant="outline" onClick={() => {
                 if(confirm("¿Seguro que quieres borrar TODOS los puestos?")) clearPositions();
            }}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                Borrar Puestos
            </Button>
        </div>
      </div>

      <DictionaryQueue />

      {/* Seccion Estadisticas de Proveedores */}
      <section className="space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-2xl font-semibold">Salud del Sistema (Backend)</h2>
            <Button variant="ghost" size="sm" onClick={refreshAllData} disabled={loadingStats}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? 'animate-spin' : ''}`} />
                Actualizar Todo
            </Button>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Estado y Reputación</CardTitle>
                <CardDescription>
                    Puntajes dinámicos basados en feedback y estabilidad técnica.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {Object.keys(backendStats).length === 0 ? (
                    <p className="text-muted-foreground italic">No hay datos de backend disponibles.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Proveedor</TableHead>
                                <TableHead>Puntaje (Score)</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Gen/Acept/Rech/Err</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(backendStats).map(([id, state]) => {
                                const isPaused = state.cooldownUntil && state.cooldownUntil > Date.now();
                                return (
                                    <TableRow key={id}>
                                        <TableCell className="font-medium capitalize">{id}</TableCell>
                                        <TableCell className="font-bold">{state.score.toFixed(0)}</TableCell>
                                        <TableCell>
                                            {isPaused ? (
                                                <span className="text-red-500 font-semibold flex items-center">
                                                    PAUSADO 
                                                    <span className="text-xs ml-1 font-normal text-muted-foreground">
                                                        ({Math.ceil((state.cooldownUntil! - Date.now()) / 1000)}s)
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-green-600 font-semibold">ACTIVO</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                            {state.totalGenerated}/{state.totalAccepted}/{state.totalRejected}/{state.totalErrors}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>

        <h2 className="text-2xl font-semibold border-b pb-2 pt-8">Rendimiento de IAs (Cliente)</h2>
        <Card>
            <CardHeader>
                <CardTitle>Estadísticas de Proveedores</CardTitle>
                <CardDescription>Eficacia basada en aceptación de respuestas y estado de conexión.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Estado (Ping)</TableHead>
                            <TableHead>Generadas</TableHead>
                            <TableHead>Aceptadas</TableHead>
                            <TableHead>Rechazadas</TableHead>
                            <TableHead>Tasa de Éxito</TableHead>
                            <TableHead>Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {PROVIDER_IDS.map((provider) => {
                            const stats = providerStats[provider] || { generated: 0, accepted: 0, rejected: 0 };
                            const rate = stats.generated > 0 ? ((stats.accepted / stats.generated) * 100).toFixed(1) : "N/A";
                            const ping = pingResults[provider];

                            return (
                                <TableRow key={provider}>
                                    <TableCell className="font-medium capitalize flex items-center gap-2">
                                        {provider}
                                    </TableCell>
                                    <TableCell>
                                        {ping?.status === 'loading' && <span className="text-yellow-600 flex items-center gap-1"><Activity className="h-3 w-3 animate-pulse" /> Probando...</span>}
                                        {ping?.status === 'ok' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> OK ({ping.latency}ms)</span>}
                                        {ping?.status === 'error' && <span className="text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" /> Error</span>}
                                        {!ping && <span className="text-muted-foreground text-xs">-</span>}
                                    </TableCell>
                                    <TableCell>{stats.generated}</TableCell>
                                    <TableCell className="text-green-600 font-bold">{stats.accepted}</TableCell>
                                    <TableCell className="text-red-600">{stats.rejected}</TableCell>
                                    <TableCell>{rate === "N/A" ? "-" : `${rate}%`}</TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handlePing(provider)}
                                            disabled={ping?.status === 'loading'}
                                        >
                                            <Activity className="h-3 w-3 mr-1" /> Ping
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </section>

      {/* Seccion Positions */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Puestos Guardados ({positions.length})</h2>
        {positions.length === 0 ? (
          <p className="text-muted-foreground italic">No hay puestos guardados.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.map((pos, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{pos}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Seccion Applications */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Postulaciones ({applications.length})</h2>
        {applications.length === 0 ? (
          <p className="text-muted-foreground italic">No hay postulaciones guardadas.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {applications.map((app) => (
              <Card key={app.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{app.jobTitle}</CardTitle>
                      <CardDescription>{app.date} — {app.positionId || "Sin puesto asignado"}</CardDescription>
                    </div>
                    <span className="text-xs font-mono bg-background border px-2 py-1 rounded">
                      ID: {app.id}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Palabras Clave Detectadas:</h4>
                    <div className="flex flex-wrap gap-2">
                      {app.detectedWords.length > 0 ? (
                        app.detectedWords.map((word, i) => (
                          <span key={i} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                            {word}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">Ninguna</span>
                      )}
                    </div>
                  </div>
                  
                  {app.link && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Link:</h4>
                      <a href={app.link} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm truncate block">
                        {app.link}
                      </a>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold mb-1">Descripción:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {app.jobDescription}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Seccion CVs (Nueva Estructura) */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">CVs Cargados ({cvs.length})</h2>
        {cvs.length === 0 ? (
             <p className="text-muted-foreground italic">No hay CVs cargados.</p>
        ) : (
            <div className="space-y-6">
                {cvs.map((cv) => (
                     <Card key={cv.id} className={cv.isPrimary ? "border-primary" : ""}>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>{cv.name} {cv.isPrimary && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded ml-2">Activo</span>}</CardTitle>
                                <span className="text-xs text-muted-foreground">ID: {cv.id}</span>
                            </div>
                            <CardDescription>
                                Subido el: {new Date(cv.uploadDate).toLocaleString()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Keywords ({cv.keywords.length}):</h4>
                                <div className="flex flex-wrap gap-2">
                                    {cv.keywords.map((k, i) => (
                                        <span key={i} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-medium border border-primary/20">
                                            {k}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Raw Text Preview:</h4>
                                <div className="text-xs font-mono whitespace-pre-wrap bg-muted/30 p-2 rounded border">
                                    {cv.text}
                                </div>
                            </div>
                        </CardContent>
                     </Card>
                ))}
            </div>
        )}
      </section>
    </div>
  );
}