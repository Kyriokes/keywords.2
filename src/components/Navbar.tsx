export function Navbar() {
    return (
        <header className="border-b bg-background">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                {/* Logo / Nombre */}
                <a href="/home" className="text-xl font-semibold">JobTracker</a>

                {/* Navegación */}
                <nav className="flex items-center gap-4 text-sm">
                    <a href="/" className="hover:underline">
                        Landing Page
                    </a>
                    <a href="/user/add-job" className="hover:underline">
                        Agregar Búsqueda
                    </a>
                    <a href="/user/dashboard" className="hover:underline">
                        Panel de Control  
                    </a>
                    <a href="/debug" className="hover:underline text-red-500 font-bold">
                        Debug
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
