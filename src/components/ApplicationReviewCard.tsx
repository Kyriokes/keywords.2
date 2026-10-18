'use client';

import { useApplicationStore } from '@/store/applicationStore';
import { useStatsStore } from '@/store/statsStore';
import { processJobApplication } from '@/lib/ia/controller';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { SENIORITY_LABELS, isSeniority } from '@/lib/positions/rules';

export function ApplicationReviewCard() {
    const { pendingApplication, setPendingApplication, addApplication } = useApplicationStore();
    const { logAcceptance, logRejection, logGeneration } = useStatsStore();
    const [isRetrying, setIsRetrying] = useState(false);

    if (!pendingApplication) return null;

    const { data, providerUsed, excludedProviders } = pendingApplication;
    const unverifiedWords = new Set(pendingApplication.unverifiedWords);

    const handleAccept = async () => {
        try {
            // Mapear los datos al formato esperado por el server action
            await addApplication({
                ...data,
                positionId: data.positionId || data.jobTitle, // Use jobTitle as positionId/Title if not set
                provider: providerUsed,
                reviewed: true,
                status: pendingApplication.status
            });
        } catch (e) {
            // El resultado queda abierto para que el usuario pueda cancelar o reintentar
            toast.error(e instanceof Error ? e.message : "No se pudo guardar la postulación.");
            return;
        }

        logAcceptance(providerUsed);

        // Note: Server action 'createApplication' now handles persisting the 'accepted' stat to DB.
        // We only update local store here for immediate UI feedback if needed.

        setPendingApplication(null);
        toast.success("Postulación guardada correctamente");
    };

    const handleRetry = async () => {
        if (!confirm("¿Rechazar este resultado y probar con otra IA?")) return;
        
        setIsRetrying(true);
        logRejection(providerUsed);

        // Send Feedback to Server
        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId: providerUsed, action: 'reject' })
            });
        } catch(e) { console.error("Feedback error", e); }
        
        try {
            // Exclude current provider + any previously excluded
            const newExcluded = [...excludedProviders, providerUsed];
            
            const result = await processJobApplication(
                "Oferta Laboral", // Assuming generic title if not stored, but we should use data.jobTitle if it's the raw title? 
                // Wait, data.jobTitle in PendingApplication might be the *detected* position if we overwrote it.
                // data.jobDescription is the raw text.
                data.jobDescription, 
                { 
                    excludeProviders: newExcluded,
                    autoSelect: true // We assume autoSelect logic was desired or we re-use detection
                }
            );

            if (!result.ok) {
                toast.error(
                    result.code === "QUOTA_EXCEEDED"
                        ? `Límite diario alcanzado (${result.usedToday}/${result.limit}). No se puede reintentar hoy.`
                        : "Error al reintentar. Quizás no hay más IAs disponibles."
                );
                return;
            }

            // Re-map result
            // Note: We keep the original 'data' (link, raw text) but update the AI parts
            const newProvider = result.data.provider || "unknown";
            logGeneration(newProvider);

            setPendingApplication({
                data: {
                   ...data,
                   detectedWords: result.data.palabrasClave.map(k => k.nombre),
                   // If position was auto-selected, update it? 
                   // Ideally we should preserve the logic from the page, but here we are disconnected.
                   // We will assume the position stays same unless user changes it manually later, 
                   // OR we update it if it was "otros".
                   // For simplicity, let's update detected words mainly.
                },
                unverifiedWords: result.data.palabrasClave.filter(k => k.verificada === false).map(k => k.nombre),
                providerUsed: newProvider,
                excludedProviders: newExcluded
            });
            toast.info(`Reintentado. Nuevo resultado generado.`);
        } catch (e) {
            console.error(e);
            toast.error("Error al reintentar. Quizás no hay más IAs disponibles.");
        } finally {
            setIsRetrying(false);
        }
    };

    const removeWord = (word: string) => {
        setPendingApplication({
            ...pendingApplication,
            data: { ...data, detectedWords: data.detectedWords.filter((item) => item !== word) },
        });
    };

    const handleCancel = () => {
        if (confirm("¿Estás seguro de cancelar? Se perderán los datos procesados.")) {
            setPendingApplication(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border-primary/20 relative">
             <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-2 z-10 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleCancel}
             >
                <X className="h-4 w-4" />
             </Button>

             <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Revisar Resultado
                </CardTitle>
             </CardHeader>

             <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Position */}
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Puesto detectado</h3>
                    <div className="text-lg font-semibold">{data.jobTitle}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {data.role ? (
                            <>
                                Se agrupa como <span className="font-medium text-foreground">{data.role}</span>
                                {isSeniority(data.seniority) && <>, nivel {SENIORITY_LABELS[data.seniority]}</>}
                            </>
                        ) : (
                            "Todavía no corresponde a ningún rol del diccionario; queda sin clasificar."
                        )}
                    </p>
                </div>

                {/* Keywords */}
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Palabras Clave Detectadas ({data.detectedWords.length})</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                        Quitá las que no correspondan antes de guardar.
                        {unverifiedWords.size > 0 && " Las de borde punteado todavía no están en el diccionario: se guardan igual, sin verificar."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {data.detectedWords.length > 0 ? (
                            data.detectedWords.map((word, i) => {
                                const unverified = unverifiedWords.has(word);
                                return (
                                    <Badge
                                        key={`${word}-${i}`}
                                        variant={unverified ? "outline" : "secondary"}
                                        className={`gap-1 py-1 pl-3 pr-1 text-sm ${unverified ? "border-dashed font-normal text-muted-foreground" : ""}`}
                                        title={unverified ? "Todavía no está en el diccionario" : undefined}
                                    >
                                        {word}
                                        <button
                                            type="button"
                                            onClick={() => removeWord(word)}
                                            disabled={isRetrying}
                                            aria-label={`Quitar ${word}`}
                                            className="rounded-full p-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                        >
                                            <X className="h-3 w-3" aria-hidden />
                                        </button>
                                    </Badge>
                                );
                            })
                        ) : (
                            <div className="flex items-center gap-2 text-yellow-600 bg-yellow-500/10 p-2 rounded text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                No se detectaron palabras clave.
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview of Description (Truncated) */}
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Extracto de Descripción</h3>
                    <p className="text-sm text-muted-foreground/80 line-clamp-4 bg-muted p-2 rounded border font-mono">
                        {data.jobDescription}
                    </p>
                </div>

             </CardContent>

             <CardFooter className="border-t bg-muted/10 p-4 flex justify-between gap-4">
                <Button 
                    variant="outline" 
                    onClick={handleRetry} 
                    disabled={isRetrying}
                    className="flex-1 border-dashed"
                >
                    {isRetrying ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Probando otra IA...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            No me convence (Reintentar)
                        </>
                    )}
                </Button>

                <Button 
                    onClick={handleAccept} 
                    disabled={isRetrying}
                    className="flex-[2]"
                >
                    <Check className="mr-2 h-4 w-4" />
                    Aceptar y Guardar
                </Button>
             </CardFooter>
           </Card>
        </div>
    )
}
