import { DesiredPositions } from "@/components/DesiredPositions";
import { CvDropBox } from "@/components/CvDropBox";

export default function Home() {
    return(
        <div className="container mx-auto px-4 py-8 space-y-12">
            <h1 className="text-4xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 text-black dark:text-white mb-12">
                Panel de Control
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <h2 className="text-2xl font-semibold text-center md:text-left">Tu CV</h2>
                    <CvDropBox />
                </div>
                
                <div className="space-y-6">
                    <h2 className="text-2xl font-semibold text-center md:text-left">Puestos Deseados</h2>
                    <DesiredPositions />
                </div>
            </div>
        </div>
    )
}