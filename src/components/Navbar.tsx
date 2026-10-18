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
        <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl">
            <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
                <Link
                    href={isLoggedIn ? "/user/dashboard" : "/"}
                    className="text-base font-semibold tracking-tight text-foreground"
                >
                    KeyWords
                </Link>

                <nav className="hidden items-center text-sm font-medium md:flex">
                    <Link
                        href="/"
                        className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
                    >
                        Inicio
                    </Link>
                    {!isLoggedIn && (
                        <Link href="/#como-funciona" className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground">
                            Cómo funciona
                        </Link>
                    )}
                    {isLoggedIn && (
                        <>
                            <Link href="/user/add-job" className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground">
                                Agregar postulación
                            </Link>
                            <Link href="/user/dashboard" className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground">
                                Mis postulaciones
                            </Link>
                            <Link href="/user/queue" className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground">
                                Cola
                            </Link>
                            <Link href="/user/profile" className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground">
                                Mi perfil
                            </Link>
                            {session?.user?.role === "ADMIN" && (
                                <Link href="/admin" className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground">
                                    Admin
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
                            className="rounded-full text-muted-foreground"
                        >
                            Cerrar sesión
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/login">
                                <Button variant="default" className="rounded-full font-semibold">
                                    Iniciar sesión
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
