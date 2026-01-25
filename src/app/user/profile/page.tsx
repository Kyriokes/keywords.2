"use client";

import { CvDropBox } from "@/components/CvDropBox";
import { CvList } from "@/components/CvList";
import { DesiredPositions } from "@/components/DesiredPositions";

export default function ProfilePage() {
    return (
        <div className="container mx-auto px-4 py-8 space-y-12">
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 text-black dark:text-white">
                Mi Perfil
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <h2 className="text-2xl font-semibold tracking-tight">Tu CV</h2>
                    <p className="text-muted-foreground">
                        Gestiona el currículum base que usaremos para analizar las ofertas.
                    </p>
                    <CvDropBox />
                    <CvList />
                </div>
                
                <div className="space-y-6">
                    <h2 className="text-2xl font-semibold tracking-tight">Puestos Deseados</h2>
                    <p className="text-muted-foreground">
                        Define los roles que estás buscando para clasificar tus postulaciones.
                    </p>
                    <DesiredPositions />
                </div>
            </div>
        </div>
    );
}
