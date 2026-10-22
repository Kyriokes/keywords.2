import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "No se pudo iniciar sesión", robots: { index: false, follow: false } };

type OAuthErrorPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

const MESSAGES: Record<string, { title: string; description: string }> = {
  oauth_email_missing: {
    title: "LinkedIn no devolvió un email válido",
    description:
      "Para vincular cuentas necesitamos el email de LinkedIn. Probá ingresar con Google o revisá los permisos de tu cuenta de LinkedIn.",
  },
  oauth_email_unverified: {
    title: "Tu email no está verificado",
    description:
      "Ya existe una cuenta con ese email y solo podemos vincularla si el proveedor confirma que el email es tuyo. Verificalo ahí o ingresá con Google.",
  },
  oauth_linking_failed: {
    title: "No se pudo completar el acceso con LinkedIn",
    description: "Hubo un problema al vincular tu cuenta. Intentá nuevamente o ingresá con Google.",
  },
};

export default async function OAuthErrorPage({ searchParams }: OAuthErrorPageProps) {
  const { reason } = await searchParams;
  const { title, description } = MESSAGES[reason ?? ""] ?? MESSAGES.oauth_linking_failed;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/login">Volver al login</Link>
          </Button>
          <form
            action={async () => {
              "use server";
              const { signIn } = await import("@/auth");
              await signIn("google", { redirectTo: "/user/dashboard" });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Continuar con Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
