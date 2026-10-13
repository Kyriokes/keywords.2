import type { Metadata } from "next";
import Link from "next/link";
import { primaryButton } from "@/components/landing/styles";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <div className="landing mx-auto flex min-h-[70svh] w-full max-w-[680px] flex-col items-start justify-center gap-6 px-4 py-24 sm:px-6">
      <p className="font-mono text-sm text-muted-foreground">Error 404</p>
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Esta dirección no existe</h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Puede que el enlace esté mal escrito o que la página haya cambiado de lugar.
        </p>
      </div>
      <Link href="/" className={primaryButton}>
        Volver al inicio
      </Link>
    </div>
  );
}
