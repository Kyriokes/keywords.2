'use client';

import { motion } from 'framer-motion';
import { Lock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { LandingCard } from '@/components/LandingCard';
import { LoadSaveDropzone } from '@/components/LoadSaveDropzone';
import { containerVariants, itemVariants } from '@/lib/animations';

export default function LandingPage() {

  const handleLogin = () => {
    toast.info("El inicio de sesión estará disponible próximamente.");
  };

  const handleNewAccount = () => {
    toast.info("La creación de nuevas sesiones estará disponible próximamente.");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] p-6 bg-gradient-to-b from-background to-muted/20">
      <motion.div
        className="max-w-4xl w-full space-y-12 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header Section */}
        <motion.div variants={itemVariants} className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 text-black dark:text-white">
            KeyWords
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-gray-600 dark:text-gray-300">
            Tu asistente inteligente para la búsqueda laboral. Gestiona tus postulaciones,
            analiza palabras clave con IA y obtén estadísticas relevantes para optimizar tu perfil.
          </p>
        </motion.div>

        {/* Options Grid */}
        <motion.div 
          variants={itemVariants} 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full"
        >
          {/* Option 1: Login (Disabled/Placeholder) */}
          <LandingCard 
            icon={<Lock className="w-10 h-10 mb-4 text-muted-foreground" />}
            title="Iniciar Sesión"
            description="Accede a tu cuenta para sincronizar tus datos en la nube."
            onClick={handleLogin}
            disabled={true}
            badge="Próximamente"
          />

          {/* Option 2: Load Save File (Dropzone) */}
          <LoadSaveDropzone />

          {/* Option 3: New Account */}
          <LandingCard 
            icon={<UserPlus className="w-10 h-10 mb-4 text-green-500" />}
            title="Nueva Sesión"
            description="Comienza desde cero. Ideal para una nueva búsqueda."
            onClick={handleNewAccount}
            disabled={true}
            badge="Próximamente"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
