"use client";

import { useApplicationStore } from "@/store/applicationStore";
import { useCvStore } from "@/store/cvStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useMemo } from "react";

export function StatsView() {
    const { applications } = useApplicationStore();
    const { keywords: cvKeywords } = useCvStore();

    // 1. Ranking de Keywords (Detectadas en ofertas)
    const keywordStats = useMemo(() => {
        const frequencyMap = new Map<string, number>();
        applications.forEach(app => {
            app.detectedWords.forEach(word => {
                frequencyMap.set(word, (frequencyMap.get(word) || 0) + 1);
            });
        });

        // Convertir a array y ordenar
        return Array.from(frequencyMap.entries())
            .map(([name, value]) => ({ 
                name, 
                value,
                inCv: cvKeywords.some(k => k.toLowerCase() === name.toLowerCase())
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10
    }, [applications, cvKeywords]);

    // 2. Porcentaje de Coincidencia (Placeholder lógica simple)
    // Calcula qué porcentaje de las keywords TOP 10 de las ofertas tienes en tu CV
    const matchPercentage = useMemo(() => {
        if (keywordStats.length === 0) return 0;
        const matches = keywordStats.filter(k => k.inCv).length;
        return Math.round((matches / keywordStats.length) * 100);
    }, [keywordStats]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráfico 1: Top Keywords */}
            <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                    <CardTitle>Palabras Clave más Demandadas</CardTitle>
                    <CardDescription>
                        Top 10 términos encontrados en tus postulaciones. 
                        <span className="ml-2 text-green-600 font-medium">Verde: Presente en tu CV</span>, 
                        <span className="ml-2 text-orange-500 font-medium">Naranja: Faltante</span>.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    {keywordStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={keywordStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                />
                                <Bar dataKey="value" name="Frecuencia">
                                    {keywordStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.inCv ? "#22c55e" : "#f97316"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            No hay suficientes datos para generar estadísticas.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Métrica: Coincidencia de Mercado */}
            <Card>
                <CardHeader>
                    <CardTitle>Alineación con el Mercado</CardTitle>
                    <CardDescription>
                        Basado en el Top 10 de habilidades requeridas vs tu CV.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                    <div className="text-center">
                        <span className="text-6xl font-bold text-primary">{matchPercentage}%</span>
                        <p className="text-sm text-muted-foreground mt-2">
                            De las habilidades más pedidas están en tu CV.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Placeholder para actividad temporal (A futuro) */}
            <Card>
                <CardHeader>
                    <CardTitle>Actividad Reciente</CardTitle>
                    <CardDescription>
                        Postulaciones realizadas (Próximamente gráfico temporal)
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                    <div className="text-center space-y-2">
                        <p className="text-4xl font-bold">{applications.length}</p>
                        <p className="text-sm text-muted-foreground">Total Postulaciones</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
