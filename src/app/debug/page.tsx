"use client";

import { useCvStore } from "@/store/cvStore";
import { useApplicationStore } from "@/store/applicationStore";
import { usePositionStore } from "@/store/PositionStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugPage() {
  const { keywords, rawText } = useCvStore();
  const { applications } = useApplicationStore();
  const { positions } = usePositionStore();

  return (
    <div className="container mx-auto p-6 space-y-10">
      <h1 className="text-3xl font-bold mb-6">Estado del Store (Debug)</h1>

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
                    <h4 className="text-sm font-semibold mb-1">Descripción (Extracto):</h4>
                    <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">
                      {app.jobDescription}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Seccion Legacy (Keywords & RawText) */}
      {(keywords.length > 0 || rawText) && (
        <section className="space-y-4 opacity-75">
          <h2 className="text-xl font-semibold border-b pb-2">Legacy State (V1)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card>
                <CardHeader>
                    <CardTitle>Legacy Keywords</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {keywords.map((k, i) => <span key={i} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-medium border border-primary/20">{k}</span>)}
                    </div>
                </CardContent>
             </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Raw Text</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-xs font-mono max-h-96 overflow-y-auto whitespace-pre-wrap bg-muted/30 p-2 rounded border">{rawText}</div>
                </CardContent>
             </Card>
          </div>
        </section>
      )}
    </div>
  );
}
