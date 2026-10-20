import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { CvDropBox } from "@/components/CvDropBox";
import { CvList } from "@/components/CvList";
import { CvFiles } from "@/components/CvFiles";
import { DesiredPositions } from "@/components/DesiredPositions";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
    const session = await auth();
    const userName = session?.user?.name;

    return (
        <div className="container mx-auto px-4 py-8 space-y-12">
            <h1 className="text-3xl font-semibold sm:text-4xl">
                Mi perfil{userName ? `: ${userName}` : ''}
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <h2 className="text-2xl font-semibold tracking-tight">Tu CV</h2>
                    <p className="text-muted-foreground">
                        Gestiona el currículum base que usaremos para analizar las ofertas.
                    </p>
                    <CvDropBox />
                    <CvList />
                    <CvFiles />
                </div>
                
                <div className="space-y-6">
                    <h2 className="text-2xl font-semibold tracking-tight">Puestos Deseados</h2>
                    <p className="text-muted-foreground">
                        Define los roles que estás buscando para clasificar tus postulaciones.
                    </p>
                    <DesiredPositions />
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight">Postular con Claude Code</h2>
                <p className="text-muted-foreground">
                    Conectá Claude Code para que complete los formularios de tus ofertas aprobadas y registre acá lo que envió.
                </p>
                <Link href="/user/connect" className="inline-block font-medium text-primary underline-offset-4 hover:underline">
                    Conectar Claude Code →
                </Link>
            </div>
        </div>
    );
}
