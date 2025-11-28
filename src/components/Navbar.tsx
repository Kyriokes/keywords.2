export function Navbar() {
    return (
        <header className="border-b bg-white">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                {/* Logo / Nombre */}
                <h1 className="text-xl font-semibold">JobTracker</h1>

                {/* Navegación */}
                <nav className="flex items-center gap-4 text-sm">
                    <a href="/home" className="hover:underline">
                        Inicio
                    </a>
                    <a href="#features" className="hover:underline">
                        Características
                    </a>
                    <a href="#about" className="hover:underline">
                        Sobre el proyecto
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
