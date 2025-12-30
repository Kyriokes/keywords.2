"use client";

import { useState } from "react";
import { useCvStore } from "@/store/cvStore";
import { usePositionStore } from "@/store/PositionStore";
import { Button } from "@/components/ui/button";
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
    const { addApplication } = useCvStore();
    const { positions } = usePositionStore();

    const [rawText, setRawText] = useState("");
    const [selectedPosition, setSelectedPosition] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoSelect, setAutoSelect] = useState(false);

    const handleProcess = async () => {
        if (!rawText.trim()) {
            toast.error("Por favor, pega el texto de la oferta.");
            return;
        }
        if (!autoSelect && !selectedPosition) {
            toast.error("Por favor, selecciona un puesto.");
            return;
        }

        setIsProcessing(true);
        try {
            // Llamamos a la IA (simulada o real según configuración)
            // En una app real, esto debería ir a un Server Action o API Route para no exponer keys
            // Por ahora llamamos al controller directamente (asumiendo que corre en cliente o que migraremos a server action)
            // Nota: El controller de IA que portamos usa fetch a localhost:11434 (Ollama), 
            // así que funcionará si el usuario tiene Ollama corriendo localmente.
            
            // Para simplificar y no depender de Ollama ya mismo, usaremos el fallback local si falla
            const aiResponse = await processJobApplication(
                "Oferta Laboral",
                rawText,
                autoSelect ? { autoSelect: true, candidatePositions: positions } : undefined
            );
            
            // Intentar extraer link del texto (regex simple)
            const linkMatch = rawText.match(/https?:\/\/[^\s]+/);
            const link = linkMatch ? linkMatch[0] : "";

            let chosenPosition = autoSelect ? (aiResponse.puesto || "otros") : selectedPosition;

            addApplication({
                jobTitle: chosenPosition || "otros",
                jobDescription: rawText,
                detectedWords: aiResponse.palabrasClave.map(k => k.nombre),
                positionId: chosenPosition,
                link: link
            });

            toast.success("¡Oferta procesada y guardada!");
            setRawText("");
        } catch (error) {
            console.error(error);
            if (error instanceof Error && error.message === "Duplicate link") {
                toast.error("Esta oferta ya existe (link duplicado).");
            } else {
                toast.error("Error al procesar la oferta.");
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
                    <Label htmlFor="position">Puesto Objetivo</Label>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <Select
                                value={selectedPosition}
                                onValueChange={autoSelect ? () => {} : setSelectedPosition}
                            >
                                <SelectTrigger className={autoSelect ? "pointer-events-none opacity-50" : ""}>
                                    <SelectValue placeholder="Selecciona el puesto..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="otros">Otros</SelectItem>
                                    {positions.map((pos) => (
                                        <SelectItem key={pos} value={pos}>
                                            {pos}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Dejar que la IA decida</span>
                            <button
                                type="button"
                                onClick={() => {
                                    const next = !autoSelect;
                                    setAutoSelect(next);
                                    if (next) setSelectedPosition("");
                                }}
                                aria-pressed={autoSelect}
                                className={`relative inline-flex h-6 w-10 rounded-full transition-colors ${
                                    autoSelect ? "bg-primary" : "bg-muted"
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
                                        autoSelect ? "translate-x-5" : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                    {positions.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No tienes puestos creados. Ve al <a href="/user/dashboard" className="text-primary hover:underline">Dashboard</a> para crear uno.
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="jobText">Texto de la Oferta (Título + Descripción + Link)</Label>
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
