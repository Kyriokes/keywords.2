'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Verificar sesión al montar y cuando cambia la ruta
    useEffect(() => {
        // Simple check: intentamos leer la cookie desde el cliente o verificamos acceso
        // Nota: Las cookies httpOnly no se pueden leer con document.cookie directamente,
        // pero podemos asumir estado basado en si la ruta /user/* es accesible o usar un endpoint de "me".
        // Para simplificar y dado que es un auth simple, asumiremos que si estamos en /user estamos logueados,
        // o podemos hacer un fetch rápido a un endpoint de check.
        
        // Mejor enfoque para esta implementación simple:
        // Como el middleware protege /user, si estamos ahí, estamos logueados.
        // Pero para mostrar el botón correcto en la home, necesitamos saberlo.
        // Haremos un pequeño "hack" seguro: intentar acceder a una ruta protegida (ping) o verificar una cookie no-httpOnly si la tuvieramos.
        // Como usamos httpOnly, haremos un fetch a un nuevo endpoint de status o simplemente comprobaremos acceso.
        
        checkSession();
    }, [pathname]);

    const checkSession = async () => {
        try {
            // Creamos un endpoint ligero para verificar auth
            const res = await fetch('/api/auth/status');
            setIsLoggedIn(res.ok);
        } catch (e) {
            setIsLoggedIn(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            toast.success('Sesión cerrada');
            setIsLoggedIn(false);
            router.push('/');
            router.refresh();
        } catch (error) {
            toast.error('Error al cerrar sesión');
        }
    };

    return (
        <header className="border-b bg-background">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                {/* Logo / Nombre */}
                <Link href={isLoggedIn ? "/user/dashboard" : "/"} className="text-xl font-semibold">
                    JobTracker
                </Link>

                {/* Navegación */}
                <nav className="flex items-center gap-6 text-sm font-medium">
                    <Link href="/" className="hover:text-primary transition-colors">
                        Inicio
                    </Link>
                    {isLoggedIn && (
                        <>
                            <Link href="/user/add-job" className="hover:text-primary transition-colors">
                                Agregar Postulación
                            </Link>
                            <Link href="/user/dashboard" className="hover:text-primary transition-colors">
                                Panel de Control  
                            </Link>
                            <Link href="/user/profile" className="hover:text-primary transition-colors">
                                Mi Perfil
                            </Link>
                            <Link href="/debug" className="hover:text-red-500 text-muted-foreground/50 transition-colors text-xs">
                                (Debug)
                            </Link>
                        </>
                    )}
                </nav>

                {/* Login / Logout */}
                <div className="flex items-center gap-4">
                    {isLoggedIn ? (
                        <Button 
                            variant="ghost" 
                            onClick={handleLogout}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                            Cerrar Sesión
                        </Button>
                    ) : (
                        <Link href="/login">
                            <Button variant="default">
                                Iniciar Sesión
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
