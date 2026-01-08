export function Navbar() {
    return (
        <header className="border-b bg-background">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                {/* Logo / Nombre */}
                <a href="/home" className="text-xl font-semibold">JobTracker</a>

                {/* Navegación */}
                <nav className="flex items-center gap-6 text-sm font-medium">
                    <a href="/" className="hover:text-primary transition-colors">
                        Inicio
                    </a>
                    <a href="/user/add-job" className="hover:text-primary transition-colors">
                        Agregar Postulación
                    </a>
                    <a href="/user/dashboard" className="hover:text-primary transition-colors">
                        Panel de Control  
                    </a>
                    <a href="/user/profile" className="hover:text-primary transition-colors">
                        Mi Perfil
                    </a>
                    <a href="/debug" className="hover:text-red-500 text-muted-foreground/50 transition-colors text-xs">
                        (Debug)
                    </a>
                </nav>

                {/* Login placeholder */}
                <div className="text-sm text-muted-foreground">
                    {/* Más adelante: login real */}
                    Iniciar sesión / Usuario
                </div>
            </div>
        </header>
    );
}
