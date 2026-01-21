"use client";

import { useCvStore } from "@/store/cvStore";
import { useApplicationStore } from "@/store/applicationStore";
import { usePositionStore } from "@/store/PositionStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DebugPage() {
  const { cvs, activeCvId } = useCvStore();
  const { applications, clearAllApplications } = useApplicationStore();
  const { positions, clearPositions } = usePositionStore();

  return (
    <div className="container mx-auto p-6 space-y-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Estado del Store (Debug)</h1>
        <div className="flex gap-2">
            <Button variant="destructive" onClick={() => {
                if(confirm("¿Seguro que quieres borrar TODAS las postulaciones?")) clearAllApplications();
            }}>
                Borrar Postulaciones
            </Button>
            <Button variant="outline" onClick={() => {
                 if(confirm("¿Seguro que quieres borrar TODOS los puestos?")) clearPositions();
            }}>
                Borrar Puestos
            </Button>
        </div>
      </div>

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
                     <Card key={cv.id} className={activeCvId === cv.id ? "border-primary" : ""}>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>{cv.name} {activeCvId === cv.id && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded ml-2">Activo</span>}</CardTitle>
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
