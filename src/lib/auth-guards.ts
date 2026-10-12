import "server-only";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";

/**
 * true solo si el usuario de la sesión es ADMIN según la base de datos.
 * No confía en el rol del JWT: un token emitido antes de un cambio de rol seguiría diciendo lo viejo.
 */
export async function isAdminSession(): Promise<boolean> {
    const session = await auth();
    if (!session?.user?.id) return false;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    });
    return user?.role === UserRole.ADMIN;
}
