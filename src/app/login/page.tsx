
import type { Metadata } from "next";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Entrá con tu cuenta de Google para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/user/dashboard" });
            }}
          >
            <Button type="submit" className="w-full">
              Continuar con Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
