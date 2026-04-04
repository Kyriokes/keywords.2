export function Footer() {
    return (
        <footer className="mt-10 border-t bg-background">
            <div className="container mx-auto space-y-3 px-4 py-6 text-center text-sm text-muted-foreground">
                <p>
                    KeyWords · Organizá tus postulaciones y descubrí qué mejorar.
                </p>

                <p>
                    Hecho con ❤️ por{" "}
                    <span className="font-medium">Sergio Ferrari</span>
                </p>

                <div className="flex justify-center gap-4">
                    <a
                        href="https://github.com/kyriokes"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                    >
                        GitHub
                    </a>

                    <a
                        href="https://linkedin.com/in/sergiofb"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                    >
                        LinkedIn
                    </a>
                </div>
            </div>
        </footer>
    );
}
