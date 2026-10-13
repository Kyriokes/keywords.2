"use client";

import { useRef } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApplicationStore } from "@/store/applicationStore";
import { useCvStore } from "@/store/cvStore";
import { usePositionStore } from "@/store/PositionStore";
import { useStatsStore } from "@/store/statsStore";
import type { SystemBackup } from "@/types/admin";

export function DataPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { clearAllApplications } = useApplicationStore();
  const { clearPositions, setPositions } = usePositionStore();
  const { importStats } = useStatsStore();

  const handleDownloadBackup = async () => {
    // Los datos se piden recién al exportar: la página ya no los carga ni los muestra
    await Promise.all([
      useApplicationStore.getState().fetchApplications(),
      useCvStore.getState().fetchCVs(),
      usePositionStore.getState().fetchPositions(),
    ]);

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
        if (confirm("Esto sobrescribirá tus puestos deseados y las estadísticas de proveedores guardadas en este navegador. ¿Estás seguro?")) {
          if (data.positions && Array.isArray(data.positions)) setPositions(data.positions);
          if (data.stats) importStats(data.stats);
          toast.success("Backup restaurado correctamente");
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (err: unknown) {
        console.error(err);
        toast.error("Error al leer el archivo de backup.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tus datos</CardTitle>
        <CardDescription>
          Estas acciones afectan solo a tu cuenta. Tus postulaciones y CVs se ven en Mis Postulaciones y Mi Perfil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
        </div>

        <div className="space-y-3 border-t pt-6">
          <p className="text-sm text-muted-foreground">Borrar no se puede deshacer.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => {
              if (confirm("¿Seguro que quieres borrar TODAS las postulaciones?")) clearAllApplications();
            }}>
              <Trash2 className="mr-2 h-4 w-4" />
              Borrar Postulaciones
            </Button>
            <Button variant="outline" onClick={() => {
              if (confirm("¿Seguro que quieres borrar TODOS los puestos?")) clearPositions();
            }}>
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              Borrar Puestos
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
