import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <ShieldAlert className="w-20 h-20 text-red-500 mb-6" />
      <h1 className="text-4xl font-bold mb-4">Acceso Denegado</h1>
      <p className="text-gray-600 max-w-md mb-8">
        No tienes los permisos necesarios para ver esta página. Si crees que esto es un error, contacta al administrador.
      </p>
      <Link 
        href="/user"
        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Volver al Inicio
      </Link>
    </div>
  );
}
