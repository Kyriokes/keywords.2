"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProviderState } from "@/lib/ia/providerManager";
import { PROVIDER_IDS } from "@/lib/ia/providers/ids";
import { useStatsStore } from "@/store/statsStore";
import type { PingResponse } from "@/types/admin";

type PingResult = { status: 'ok' | 'error' | 'loading'; latency?: number };

async function loadBackendStats(): Promise<Record<string, ProviderState>> {
  const res = await fetch('/api/debug/providers');
  if (!res.ok) throw new Error('Error al obtener estadísticas');
  return res.json();
}

export function ProvidersPanel() {
  const { providerStats } = useStatsStore();

  const [backendStats, setBackendStats] = useState<Record<string, ProviderState>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});

  useEffect(() => {
    let cancelled = false;
    loadBackendStats()
      .then((data) => {
        if (!cancelled) setBackendStats(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Error al cargar estado del backend");
      })
      .finally(() => {
        if (!cancelled) setLoadingStats(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    setLoadingStats(true);
    try {
      setBackendStats(await loadBackendStats());
    } catch {
      toast.error("Error al cargar estado del backend");
    } finally {
      setLoadingStats(false);
    }
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
    } catch {
      setPingResults(prev => ({ ...prev, [providerId]: { status: 'error' } }));
      toast.error(`Error de red al contactar ${providerId}`);
    }
  };

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Estado y Reputación</CardTitle>
            <CardDescription>
              Puntajes dinámicos basados en feedback y estabilidad técnica.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loadingStats}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
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
                    <TableCell className="font-medium capitalize">{provider}</TableCell>
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
  );
}
