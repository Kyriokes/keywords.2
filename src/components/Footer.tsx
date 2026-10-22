export function Footer() {
    return (
        <footer className="border-t bg-background">
            <div className="container mx-auto space-y-3 px-4 py-6 text-center text-sm text-muted-foreground">
                <p>
                    KeyWords. Sabé qué piden las ofertas y cuánto de eso ya tenés.
                </p>

                <p>
                    Hecho con ❤️ por{" "}
                    <a
                        href="https://portfoliosergiofb.vercel.app/es"
                        target="_blank"
                        rel="noopener"
                        className="font-medium hover:underline"
                    >
                        Sergio Ferrari Bryce
                    </a>
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
