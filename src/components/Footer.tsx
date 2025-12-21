export function Footer() {
    return (
        <footer className="border-t bg-background mt-10">
            <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground space-y-2">
                <p>
                    Hecho con ❤️ por{" "}
                    <span className="font-medium">Sergio Ferrari</span>
                </p>

                <div className="flex justify-center gap-4">
                    <a
                        href="https://github.com/kyriokes"
                        target="_blank"
                        className="hover:underline"
                    >
                        GitHub
                    </a>

                    <a
                        href="https://linkedin.com/in/sergiofb"
                        target="_blank"
                        className="hover:underline"
                    >
                        LinkedIn
                    </a>

                    {/* Placeholder para MercadoPago / ML */}
                    <span className="italic">
                        Donaciones (ML) — próximamente
                    </span>
                </div>
            </div>
        </footer>
    );
}
