import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { primaryButton } from "@/components/landing/styles";

export const metadata: Metadata = { title: "Acceso denegado", robots: { index: false, follow: false } };

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <ShieldAlert className="mb-6 size-12 text-muted-foreground" />
      <h1 className="mb-4 text-4xl font-semibold">Acceso denegado</h1>
      <p className="mb-8 max-w-md text-lg text-muted-foreground">
        No tenés los permisos necesarios para ver esta página. Si creés que es un error, avisale al administrador.
      </p>
      <Link href="/user/dashboard" className={primaryButton}>
        Volver al inicio
      </Link>
    </div>
  );
}
