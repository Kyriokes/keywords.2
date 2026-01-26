"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadSaveDropzone } from "@/components/LoadSaveDropzone";
import { useApplicationStore } from "@/store/applicationStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ApplicationsTable } from "@/components/ApplicationsTable";
import { StatsView } from "@/components/StatsView";

export default function DashboardPage() {
    const { applications } = useApplicationStore();
    // const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 text-black dark:text-white">
                    Panel de Control
                </h1>
                <div className="w-full md:w-auto">
                   {/* Espacio reservado para acciones globales si se necesitan */}
                </div>
            </div>

            <Tabs defaultValue="applications" className="w-full space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                        <TabsTrigger value="applications">Mis Postulaciones</TabsTrigger>
                        <TabsTrigger value="stats">Estadísticas</TabsTrigger>
                    </TabsList>
                </div>

                {/* Sección de Carga/Descarga (Excel) */}
                <Card className="bg-muted/30 border-dashed">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            📂 Gestión de Datos
                        </CardTitle>
                        <CardDescription>
                            Importa o exporta tu progreso para no perder tus postulaciones.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="max-w-xl">
                             <LoadSaveDropzone />
                        </div>
                    </CardContent>
                </Card>

                <TabsContent value="applications" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historial de Postulaciones</CardTitle>
                            <CardDescription>
                                Total: {applications.length} postulaciones registradas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ApplicationsTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stats" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Análisis y Estadísticas</CardTitle>
                            <CardDescription>
                                Visualiza tu progreso y mejora tu estrategia.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <StatsView />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
