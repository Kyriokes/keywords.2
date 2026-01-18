'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Lock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { LandingCard } from '@/components/LandingCard';
import { containerVariants, itemVariants } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/status');
      setIsLoggedIn(res.ok);
    } catch (e) {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    if (isLoggedIn) {
      router.push('/user/dashboard');
    } else {
      router.push('/login');
    }
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
          <div className="pt-4 flex justify-center gap-4">
            {isLoading ? (
              <Button size="lg" disabled className="gap-2">
                Cargando...
              </Button>
            ) : isLoggedIn ? (
              <Link href="/user/dashboard">
                <Button size="lg" className="gap-2">
                  Ir al Panel de Control <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Iniciar Sesión <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </motion.div>

        {/* Options Grid */}
        <motion.div 
          variants={itemVariants} 
          className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mx-auto"
        >
          {/* Option 1: Login / Dashboard */}
          <LandingCard 
            icon={<Lock className="w-10 h-10 text-primary" />}
            title={isLoggedIn ? "Panel de Control" : "Iniciar Sesión"}
            description={isLoggedIn ? "Gestiona tus postulaciones y perfil." : "Accede a tu cuenta para sincronizar tus datos."}
            onClick={handleLogin}
          />

          {/* Option 2: New Account */}
          <LandingCard 
            icon={<UserPlus className="w-10 h-10 text-green-500" />}
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
