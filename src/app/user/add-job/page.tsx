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
import { getMyQuotaStatus } from "@/lib/quota.service";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getKeywordStats } from "@/lib/stats/keywordAnalysis";

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
            getMyQuotaStatus().catch(() => null), // Se llama desde server action con session interna
        ]).finally(() => {
            if (!cancelled) setIsHydrating(false);
        });

        // Cargar quota por separado (server action con auth interna)
        loadQuota();

        return () => { cancelled = true; };
    }, [fetchApplications, fetchCVs]);

    const loadQuota = async () => {
        try {
            // getQuotaStatus se llama sin userId porque lo obtiene de la sesión internamente
            // Si lo tenés así, pasá "" o refactorizá para que use auth() interno
            const status = await getMyQuotaStatus();
            if (status) setQuota(status);
        } catch {
            // Silencioso — la quota es informativa, no bloquea la UI de cargar
        }
    };

    const activeCv = useMemo(() =>
        cvs.find(c => c.isPrimary) || cvs[0] || null,
    [cvs]);

    const cvKeywords = activeCv?.keywords || [];

    const keywordStats = useMemo(
        () => getKeywordStats(applications, cvKeywords),
        [applications, cvKeywords]
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
            const aiResponse = await processJobApplication(
                "Oferta Laboral",
                rawText,
                { autoSelect: true, candidatePositions: [] }
            );
            
            const rawJobTitle = aiResponse.puesto || "Oferta Laboral";
            const provider = aiResponse.provider || "unknown";
            
            logGeneration(provider);

            setPendingApplication({
                data: {
                    jobTitle: rawJobTitle,
                    jobDescription: rawText,
                    detectedWords: aiResponse.palabrasClave.map(k => k.nombre),
                    positionId: undefined,
                    link: link.trim()
                },
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

        } catch (error) {
            if (error instanceof Error) {
                if (error.message.startsWith("QUOTA_EXCEEDED")) {
                    // Parseamos los datos del error: QUOTA_EXCEEDED:used:limit:resetsAt
                    const parts = error.message.split(":");
                    const used = Number(parts[1]);
                    const limit = Number(parts[2]);
                    const resetsAt = new Date(parts.slice(3).join(":")); // ISO tiene ":" en la hora
                    
                    const resetsAtStr = resetsAt.toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Argentina/Buenos_Aires"
                    });

                    toast.error(
                        `Límite diario alcanzado (${used}/${limit}). Tus análisis se recargan a las ${resetsAtStr} hs.`,
                        { duration: 6000 }
                    );
                } else if (error.message === "Duplicate link") {
                    toast.error("Esta oferta ya existe (link duplicado).");
                } else if (error.message === "AI_SERVICE_UNAVAILABLE") {
                    toast.error("El servidor de IA no responde. Por favor, aguarda e inténtalo de nuevo más tarde.");
                } else if (error.message === "UNAUTHENTICATED") {
                    toast.error("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
                } else {
                    toast.error("Error al procesar la oferta.");
                }
            } else {
                toast.error("Error desconocido al procesar la oferta.");
            }
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
                                    <h3 className="text-sm font-semibold text-green-600">Ya tenés</h3>
                                    {matched.length > 0 ? (
                                        <div className="space-y-1">
                                            {matched.map((item) => (
                                                <p key={item.normalizedName} className="text-green-600">
                                                    <span className="font-semibold">+ {item.name}</span>
                                                    <span className="ml-1 text-xs opacity-80">({item.value})</span>
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No hay coincidencias por ahora.</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold text-red-600">Te está faltando</h3>
                                    {missing.length > 0 ? (
                                        <div className="space-y-1">
                                            {missing.map((item) => (
                                                <p key={item.normalizedName} className="text-red-600">
                                                    <span className="font-semibold">- {item.name}</span>
                                                    <span className="ml-1 text-xs opacity-80">({item.value})</span>
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
