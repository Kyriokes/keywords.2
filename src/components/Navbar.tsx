'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

interface NavbarProps {
    session: Session | null;
}

export function Navbar({ session }: NavbarProps) {
    const pathname = usePathname();
    const isLoggedIn = !!session?.user;

    const handleLogout = async () => {
        try {
            await signOut({ callbackUrl: '/' });
            toast.success('Sesión cerrada');
        } catch {
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
                            <Link href="/admin" className="hover:text-red-500 text-muted-foreground/50 transition-colors text-xs">
                                (Admin)
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
