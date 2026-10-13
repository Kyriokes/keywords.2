'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { LandingNav } from "@/components/landing/LandingNav";

interface NavbarProps {
    session: Session | null;
}

export function Navbar({ session }: NavbarProps) {
    const pathname = usePathname();
    const isLoggedIn = !!session?.user;
    const isHome = pathname === '/';

    const handleLogout = async () => {
        try {
            await signOut({ callbackUrl: '/' });
            toast.success('Sesión cerrada');
        } catch {
            toast.error('Error al cerrar sesión');
        }
    };

    // La portada tiene su propia navegación; el resto de la app conserva la barra
    if (isHome) {
        return (
            <LandingNav
                isLoggedIn={isLoggedIn}
                isAdmin={session?.user?.role === "ADMIN"}
                onLogout={handleLogout}
            />
        );
    }

    return (
        <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
            <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
                <Link
                    href={isLoggedIn ? "/user/dashboard" : "/"}
                    className="text-xl font-semibold tracking-tight text-foreground"
                >
                    KeyWords
                </Link>

                <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
                    <Link
                        href="/"
                        className={`transition-colors ${isHome ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        Inicio
                    </Link>
                    {!isLoggedIn && (
                        <Link href="/#como-funciona" className="text-muted-foreground transition-colors hover:text-primary">
                            Cómo funciona
                        </Link>
                    )}
                    {isLoggedIn && (
                        <>
                            <Link href="/user/add-job" className="text-muted-foreground transition-colors hover:text-primary">
                                Agregar Postulación
                            </Link>
                            <Link href="/user/dashboard" className="text-muted-foreground transition-colors hover:text-primary">
                                Mis Postulaciones
                            </Link>
                            <Link href="/user/profile" className="text-muted-foreground transition-colors hover:text-primary">
                                Mi Perfil
                            </Link>
                            {session?.user?.role === "ADMIN" && (
                                <Link href="/admin" className="hover:text-red-500 text-muted-foreground/50 transition-colors text-xs">
                                    (Admin)
                                </Link>
                            )}
                        </>
                    )}
                </nav>

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
                        <div className="flex items-center gap-2">
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                Empezá gratis
                            </span>
                            <Link href="/login">
                                <Button variant="default">
                                    Iniciar Sesión
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
