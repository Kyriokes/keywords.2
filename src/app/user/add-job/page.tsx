"use client";

import { useEffect, useMemo, useState } from "react";
import { useApplicationStore } from "@/store/applicationStore";
import { useStatsStore } from "@/store/statsStore";
import { useCvStore } from "@/store/cvStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { processJobApplication } from "@/lib/ia/controller";
import { getMyQuotaStatus } from "@/actions/quota-actions";
import { toast } from "sonner";
import { Check, Loader2, Minus } from "lucide-react";
import { summarizeKeywords } from "@/lib/stats/keywordAnalysis";
import { useKeywordInsights } from "@/lib/stats/useKeywordInsights";

interface QuotaStatus {
    used: number;
    limit: number;
    isAdmin: boolean;
    resetsAt: Date;
}

export default function AddJobPage() {
    const { setPendingApplication, applications, fetchApplications } = useApplicationStore();
    const { cvs, fetchCVs } = useCvStore();
    const { logGeneration } = useStatsStore();

    const [rawText, setRawText] = useState("");
    const [link, setLink] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isHydrating, setIsHydrating] = useState(true);
    const [quota, setQuota] = useState<QuotaStatus | null>(null);

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            fetchApplications(),
            fetchCVs(),
            // Silencioso — la quota es informativa, no bloquea la UI de cargar
            getMyQuotaStatus().catch(() => null),
        ]).then(([, , status]) => {
            if (!cancelled && status) setQuota(status);
        }).finally(() => {
            if (!cancelled) setIsHydrating(false);
        });

        return () => { cancelled = true; };
    }, [fetchApplications, fetchCVs]);

    const activeCv = useMemo(() =>
        cvs.find(c => c.isPrimary) || cvs[0] || null,
    [cvs]);

    const { insights } = useKeywordInsights(activeCv?.id, applications.length);

    const keywordStats = useMemo(
        () => summarizeKeywords({
            keywords: insights?.keywords ?? [],
            byApplication: insights?.byApplication ?? {},
            applicationIds: applications.map(app => app.id),
        }).stats,
        [insights, applications]
    );

    const matched = useMemo(
        () => keywordStats.filter(item => item.inCv).slice(0, 5),
        [keywordStats]
    );

    const missing = useMemo(
        () => keywordStats.filter(item => !item.inCv).slice(0, 5),
        [keywordStats]
    );

    const handleProcess = async () => {
        if (!rawText.trim()) {
            toast.error("Por favor, pega el texto de la oferta.");
            return;
        }
        if (!link.trim()) {
            toast.error("Por favor, ingresa el link de la publicación.");
            return;
        }

        setIsProcessing(true);
        try {
            const result = await processJobApplication(
                "Oferta Laboral",
                rawText,
                { autoSelect: true }
            );

            if (!result.ok) {
                if (result.code === "QUOTA_EXCEEDED") {
                    const resetsAtStr = result.resetsAt.toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Argentina/Buenos_Aires"
                    });

                    toast.error(
                        `Límite diario alcanzado (${result.usedToday}/${result.limit}). Tus análisis se recargan a las ${resetsAtStr} hs.`,
                        { duration: 6000 }
                    );
                    // Sincroniza el indicador con lo que dice el servidor
                    setQuota(prev => prev && { ...prev, used: result.usedToday, limit: result.limit });
                } else if (result.code === "AI_SERVICE_UNAVAILABLE") {
                    toast.error("El servidor de IA no responde. Por favor, aguarda e inténtalo de nuevo más tarde.");
                } else if (result.code === "UNAUTHENTICATED") {
                    toast.error("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
                } else {
                    toast.error("El texto de la oferta está vacío o es demasiado largo.");
                }
                return;
            }

            const aiResponse = result.data;
            const rawJobTitle = aiResponse.puesto || "Oferta Laboral";
            const provider = aiResponse.provider || "unknown";
            
            logGeneration(provider);

            setPendingApplication({
                data: {
                    jobTitle: rawJobTitle,
                    jobDescription: rawText,
                    detectedWords: aiResponse.palabrasClave.map(k => k.nombre),
                    positionId: undefined,
                    role: aiResponse.rol,
                    seniority: aiResponse.seniority,
                    link: link.trim()
                },
                unverifiedWords: aiResponse.palabrasClave.filter(k => k.verificada === false).map(k => k.nombre),
                providerUsed: provider,
                excludedProviders: []
            });

            toast.info("Oferta procesada. Por favor revisa el resultado.");
            setRawText("");
            setLink("");

            // Actualizar quota local después de un uso exitoso
            setQuota(prev => prev && !prev.isAdmin
                ? { ...prev, used: prev.used + 1 }
                : prev
            );

        } catch {
            // Los errores esperados llegan en `result`; acá solo caen fallas de red o del servidor
            toast.error("Error al procesar la oferta.");
        } finally {
            setIsProcessing(false);
        }
    };

    const isQuotaExhausted = quota && !quota.isAdmin && quota.used >= quota.limit;

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
            <h1 className="text-3xl font-bold text-center">Cargar Nueva Postulación</h1>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                <div className="space-y-4 max-w-2xl">
                    <div className="space-y-2">
                        <Label htmlFor="jobLink">Link de la Publicación</Label>
                        <Input
                            id="jobLink"
                            placeholder="https://..."
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="jobText">Texto de la Oferta (Título + Descripción)</Label>
                        <Textarea
                            id="jobText"
                            placeholder="Pega aquí todo el contenido de la oferta..."
                            className="min-h-[300px]"
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                    </div>

                    {/* Indicador de quota */}
                    {quota && !quota.isAdmin && (
                        <div className={`text-sm px-3 py-2 rounded-md ${
                            isQuotaExhausted
                                ? "bg-red-50 text-red-600 border border-red-200"
                                : quota.used >= quota.limit * 0.8
                                    ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                                    : "bg-muted text-muted-foreground"
                        }`}>
                            {isQuotaExhausted ? (
                                <>
                                    Límite diario alcanzado ({quota.used}/{quota.limit}).{" "}
                                    Se recarga a las{" "}
                                    {quota.resetsAt.toLocaleTimeString("es-AR", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        timeZone: "America/Argentina/Buenos_Aires"
                                    })} hs.
                                </>
                            ) : (
                                <>Análisis usados hoy: {quota.used}/{quota.limit}</>
                            )}
                        </div>
                    )}

                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handleProcess}
                        disabled={isProcessing || !!isQuotaExhausted}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando con IA...
                            </>
                        ) : isQuotaExhausted ? (
                            "Límite diario alcanzado"
                        ) : (
                            "Procesar y Guardar"
                        )}
                    </Button>
                </div>

                <aside className="w-full max-w-sm mt-2 lg:mt-5 lg:ml-auto lg:sticky lg:top-6">
                    <div className="rounded-lg border bg-card p-4 space-y-4">
                        <p className="text-sm font-medium">Así estás frente a lo que pide el mercado 👇</p>
                        {isHydrating ? (
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <p>Cargando información...</p>
                            </div>
                        ) : cvs.length === 0 ? (
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <p>Aún no tenés un CV cargado.</p>
                                <p>Andá a &quot;Mi Perfil&quot; para cargar tu CV y ver coincidencias.</p>
                            </div>
                        ) : keywordStats.length === 0 ? (
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <p>Todavía no hay suficiente información.</p>
                                <p>Cargá algunas postulaciones para ver insights.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold">Ya tenés</h3>
                                    {matched.length > 0 ? (
                                        <div className="space-y-1">
                                            {matched.map((item) => (
                                                <p key={item.id} className="flex items-center gap-2 text-sm">
                                                    <Check className="size-4 shrink-0 text-skill-have" aria-hidden />
                                                    <span className="truncate font-medium">{item.name}</span>
                                                    <span className="text-xs text-muted-foreground">({item.demand})</span>
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No hay coincidencias por ahora.</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold">Te está faltando</h3>
                                    {missing.length > 0 ? (
                                        <div className="space-y-1">
                                            {missing.map((item) => (
                                                <p key={item.id} className="flex items-center gap-2 text-sm">
                                                    <Minus className="size-4 shrink-0 text-skill-gap" aria-hidden />
                                                    <span className="truncate font-medium">{item.name}</span>
                                                    <span className="text-xs text-muted-foreground">({item.demand})</span>
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">¡Vas muy bien! No hay faltantes destacados.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
