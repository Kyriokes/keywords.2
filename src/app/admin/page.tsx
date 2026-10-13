"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataPanel } from "@/components/admin/DataPanel";
import { DictionaryQueue } from "@/components/admin/DictionaryQueue";
import { PositionsQueue } from "@/components/admin/PositionsQueue";
import { ProvidersPanel } from "@/components/admin/ProvidersPanel";

export default function AdminPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Panel</h1>

      <Tabs defaultValue="dictionary" className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="dictionary">Diccionario</TabsTrigger>
          <TabsTrigger value="positions">Puestos</TabsTrigger>
          <TabsTrigger value="providers">Proveedores de IA</TabsTrigger>
          <TabsTrigger value="data">Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="dictionary" className="space-y-6">
          <DictionaryQueue />
        </TabsContent>

        <TabsContent value="positions">
          <PositionsQueue />
        </TabsContent>

        <TabsContent value="providers">
          <ProvidersPanel />
        </TabsContent>

        <TabsContent value="data">
          <DataPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
