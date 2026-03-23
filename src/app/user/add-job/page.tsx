"use client";

import { useState, useEffect } from "react";
import { useApplicationStore } from "@/store/applicationStore";
import { usePositionStore } from "@/store/PositionStore";
import { useStatsStore } from "@/store/statsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { processJobApplication } from "@/lib/ia/controller";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AddJobPage() {
    const { setPendingApplication } = useApplicationStore();
    const { positions, fetchPositions } = usePositionStore();
    const { logGeneration } = useStatsStore();

    const [rawText, setRawText] = useState("");
    const [link, setLink] = useState("");
    const [selectedPosition, setSelectedPosition] = useState<string>("none");
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchPositions();
    }, [fetchPositions]);

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
                { autoSelect: true, candidatePositions: [] } // Siempre usamos el prompt auto para extraer el título real
            );
            
            const rawJobTitle = aiResponse.puesto || "Oferta Laboral";
            const provider = aiResponse.provider || "unknown";
            
            // Log stats
            logGeneration(provider);

            // Set pending instead of adding directly
            setPendingApplication({
                data: {
                    jobTitle: rawJobTitle,
                    jobDescription: rawText,
                    detectedWords: aiResponse.palabrasClave.map(k => k.nombre),
                    positionId: selectedPosition === "none" ? undefined : selectedPosition,
                    link: link.trim()
                },
                providerUsed: provider,
                excludedProviders: []
            });

            toast.info("Oferta procesada. Por favor revisa el resultado.");
            setRawText("");
            setLink("");
        } catch (error) {
            console.error(error);
            if (error instanceof Error) {
                if (error.message === "Duplicate link") {
                    toast.error("Esta oferta ya existe (link duplicado).");
                } else if (error.message === "AI_SERVICE_UNAVAILABLE") {
                    toast.error("El servidor de IA no responde. Por favor, aguarda e inténtalo de nuevo mas tarde.");
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

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
            <h1 className="text-3xl font-bold text-center">Cargar Nueva Postulación</h1>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="position">Carpeta Personal de Puesto (Opcional)</Label>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <Select
                                value={selectedPosition}
                                onValueChange={setSelectedPosition}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una carpeta (opcional)..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin agrupar</SelectItem>
                                    {positions.map((pos) => (
                                        <SelectItem key={pos} value={pos}>
                                            {pos}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {positions.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No tienes carpetas de puestos. Ve al <a href="/user/dashboard" className="text-primary hover:underline">Dashboard</a> para crear uno.
                        </p>
                    )}
                </div>

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

                <Button 
                    className="w-full" 
                    size="lg" 
                    onClick={handleProcess} 
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando con IA...
                        </>
                    ) : (
                        "Procesar y Guardar"
                    )}
                </Button>
            </div>
        </div>
    );
}
