"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration, getProviderStatus, type ProviderSnapshot } from "@/lib/ia/providerStatus";
import { PROVIDER_IDS } from "@/lib/ia/providers/ids";
import type { PingResponse } from "@/types/admin";

// `at` es el momento de la lectura: las pausas y los "hace X" se calculan contra él
type BackendSnapshot = { stats: Record<string, ProviderSnapshot>; at: number };

async function loadBackendStats(): Promise<BackendSnapshot> {
  const res = await fetch('/api/debug/providers');
  if (!res.ok) throw new Error('Error al obtener estadísticas');
  return { stats: await res.json(), at: Date.now() };
}

function ErrorDetail({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="text-xs text-muted-foreground font-normal truncate max-w-[24rem]" title={error}>
      {error}
    </p>
  );
}

function ProviderStatusCell({ provider, now }: { provider: ProviderSnapshot; now: number }) {
  const status = getProviderStatus(provider, now);

  switch (status.kind) {
    case "unconfigured":
      return <span className="text-muted-foreground font-semibold">SIN KEY</span>;
    case "paused":
      return (
        <div>
          <span className="text-red-500 font-semibold">PAUSADO</span>
          <span className="text-xs ml-1 text-muted-foreground">({formatDuration(status.remainingMs)})</span>
          <ErrorDetail error={status.error} />
        </div>
      );
    case "failing":
      return (
        <div>
          <span className="text-amber-500 font-semibold">EN ROTACIÓN</span>
          <span className="text-xs ml-1 text-muted-foreground">· falló hace {formatDuration(now - status.at)}</span>
          <ErrorDetail error={status.error} />
        </div>
      );
    case "ok":
      return (
        <div>
          <span className="text-green-600 font-semibold">EN ROTACIÓN</span>
          <span className="text-xs ml-1 text-muted-foreground">· OK hace {formatDuration(now - status.at)}</span>
        </div>
      );
    case "unknown":
      return (
        <div>
          <span className="text-green-600 font-semibold">EN ROTACIÓN</span>
          <span className="text-xs ml-1 text-muted-foreground">· sin verificar</span>
        </div>
      );
  }
}

export function ProvidersPanel() {
  const [backend, setBackend] = useState<BackendSnapshot | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [pinging, setPinging] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    loadBackendStats()
      .then((data) => {
        if (!cancelled) setBackend(data);
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
      setBackend(await loadBackendStats());
    } catch {
      toast.error("Error al cargar estado del backend");
    } finally {
      setLoadingStats(false);
    }
  };

  const handlePing = async (providerId: string) => {
    setPinging(prev => ({ ...prev, [providerId]: true }));
    try {
      const res = await fetch(`/api/admin/ping?provider=${providerId}`);
      const data = (await res.json()) as PingResponse;

      if (res.ok && data.status === 'ok') {
        toast.success(`Ping a ${providerId} exitoso (${data.latency}ms)`);
      } else {
        toast.error(data.error || `Error al conectar con ${providerId}`);
      }
    } catch {
      toast.error(`Error de red al contactar ${providerId}`);
    } finally {
      setPinging(prev => ({ ...prev, [providerId]: false }));
    }
    // El ping actualiza el estado en el server: se vuelve a leer para mostrarlo
    await refresh();
  };

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Estado de Proveedores</CardTitle>
            <CardDescription>
              En rotación: el router lo puede elegir. Un error real o un ping fallido lo pausa 5 minutos; un ping exitoso lo reactiva.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loadingStats}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          {!backend ? (
            <p className="text-muted-foreground italic">
              {loadingStats ? "Cargando..." : "No hay datos de backend disponibles."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Puntaje (Score)</TableHead>
                  <TableHead>Gen/Acept/Rech/Err</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PROVIDER_IDS.map((id) => {
                  const provider = backend.stats[id];
                  if (!provider) return null;
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium capitalize">{id}</TableCell>
                      <TableCell>
                        <ProviderStatusCell provider={provider} now={backend.at} />
                      </TableCell>
                      <TableCell className="font-bold">{provider.score.toFixed(0)}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {provider.totalGenerated}/{provider.totalAccepted}/{provider.totalRejected}/{provider.totalErrors}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePing(id)}
                          disabled={!provider.configured || pinging[id]}
                        >
                          <Activity className={`h-3 w-3 mr-1 ${pinging[id] ? 'animate-pulse' : ''}`} />
                          {pinging[id] ? "Probando..." : "Ping"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
