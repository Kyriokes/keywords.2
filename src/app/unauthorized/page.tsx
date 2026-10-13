import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { primaryButton } from "@/components/landing/styles";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <ShieldAlert className="mb-6 size-12 text-muted-foreground" />
      <h1 className="mb-4 text-4xl font-semibold">Acceso denegado</h1>
      <p className="mb-8 max-w-md text-lg text-muted-foreground">
        No tienes los permisos necesarios para ver esta página. Si crees que esto es un error, contacta al administrador.
      </p>
      <Link href="/user/dashboard" className={primaryButton}>
        Volver al Inicio
      </Link>
    </div>
  );
}
