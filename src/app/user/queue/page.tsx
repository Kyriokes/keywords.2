import type { Metadata } from "next";
import Link from "next/link";
import { getJobSearchSettings } from "@/actions/job-search-actions";
import { getQueue } from "@/actions/queue-actions";
import { JobSearchPanel } from "@/components/JobSearchPanel";
import { QueueBoard } from "@/components/QueueBoard";

export const metadata: Metadata = { title: "Cola de postulaciones" };

// "Buscar ahora" consulta varios portales: necesita más que el tiempo por defecto
export const maxDuration = 120;

export default async function QueuePage() {
    const [queue, searchSettings] = await Promise.all([getQueue(), getJobSearchSettings()]);

    return (
        <div className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
            <div className="space-y-3">
                <h1 className="text-3xl font-semibold sm:text-4xl">Cola de postulaciones</h1>
                <p className="text-muted-foreground">
                    Aprobá las ofertas a las que querés postularte. Después decile a Claude Code &quot;postulá mi cola&quot;:
                    completa cada formulario, te pide confirmación antes de enviar y deja acá lo que respondió.
                </p>
                <p className="text-sm">
                    <Link href="/user/templates" className="font-medium text-primary underline-offset-4 hover:underline">
                        Respuestas tipo, cartas y video
                    </Link>
                    {" · "}
                    <Link href="/user/connect" className="font-medium text-primary underline-offset-4 hover:underline">
                        Conectar Claude Code
                    </Link>
                    {" · "}
                    <Link href="/user/stats" className="font-medium text-primary underline-offset-4 hover:underline">
                        Portales y resultados
                    </Link>
                </p>
            </div>
            <JobSearchPanel initial={searchSettings} />
            <QueueBoard initial={queue} />
        </div>
    );
}
