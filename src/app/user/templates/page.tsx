import type { Metadata } from "next";
import Link from "next/link";
import { getTemplates } from "@/actions/template-actions";
import { TemplatesManager } from "@/components/TemplatesManager";

export const metadata: Metadata = { title: "Respuestas tipo y cartas" };

export default async function TemplatesPage() {
    const templates = await getTemplates();

    return (
        <div className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
            <div className="space-y-3">
                <h1 className="text-3xl font-semibold sm:text-4xl">Respuestas tipo, cartas y video</h1>
                <p className="text-muted-foreground">
                    Lo que cargues acá es lo que Claude usa para completar tus postulaciones.
                </p>
                <Link href="/user/queue" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    ← Volver a la cola
                </Link>
            </div>
            <TemplatesManager initial={templates} />
        </div>
    );
}
