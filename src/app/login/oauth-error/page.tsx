import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type OAuthErrorPageProps = {
  searchParams?: { reason?: string };
};

export default async function OAuthErrorPage({ searchParams }: OAuthErrorPageProps) {
  const reason = searchParams?.reason ?? "oauth_linking_failed";

  const title =
    reason === "oauth_email_missing"
      ? "LinkedIn no devolvió un email válido"
      : "No se pudo completar el acceso con LinkedIn";

  const description =
    reason === "oauth_email_missing"
      ? "Para vincular cuentas necesitamos el email de LinkedIn. Probá ingresar con Google o revisá los permisos de tu cuenta de LinkedIn."
      : "Hubo un problema al vincular tu cuenta. Intentá nuevamente o ingresá con Google.";

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
