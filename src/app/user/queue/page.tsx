import type { Metadata } from "next";
import Link from "next/link";
import { getQueue } from "@/actions/queue-actions";
import { QueueBoard } from "@/components/QueueBoard";

export const metadata: Metadata = { title: "Cola de postulaciones" };

export default async function QueuePage() {
    const queue = await getQueue();

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
                </p>
            </div>
            <QueueBoard initial={queue} />
        </div>
    );
}
