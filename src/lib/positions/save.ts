import "server-only";

import prisma from "@/lib/prisma";
import { positionTitlesSchema, firstIssueMessage, type ActionResult } from "@/lib/validation";
import { toDesiredRoles } from "./desired";
import { getRoleCatalog } from "./dictionary";
import { OTHER_ROLE } from "./rules";

export interface DesiredRolesState {
    /** Roles deseados del perfil. */
    selected: string[];
    /** Puestos guardados antes del diccionario que no corresponden a ningún rol. */
    unrecognized: string[];
    /** Todos los roles que se pueden elegir. */
    available: string[];
}

/**
 * Puestos deseados de un perfil como roles del diccionario. Los que se guardaron como texto
 * libre se convierten al leerlos; en la base quedan normalizados la próxima vez que se guarde.
 * La comparten la app y el agente.
 */
export async function getDesiredRolesForProfile(profileId: string): Promise<DesiredRolesState> {
    const [positions, { dictionary, names }] = await Promise.all([
        prisma.position.findMany({ where: { profileId }, orderBy: { createdAt: "asc" }, select: { title: true } }),
        getRoleCatalog(),
    ]);

    const { roles, unrecognized } = toDesiredRoles(positions.map((position) => position.title), dictionary, names);

    return {
        selected: roles,
        unrecognized,
        available: Array.from(names.values())
            .filter((name) => name !== OTHER_ROLE)
            .sort((a, b) => a.localeCompare(b, "es")),
    };
}

/** Reemplaza los puestos deseados del perfil. Solo guarda roles del diccionario; devuelve los que descartó. */
export async function saveDesiredRoles(
    profileId: string,
    titles: string[]
): Promise<ActionResult<{ roles: string[]; dropped: string[] }>> {
    // Trims, drops empty strings and duplicates
    const parsed = positionTitlesSchema.safeParse(titles);
    if (!parsed.success) {
        return { ok: false, code: "INVALID_INPUT", message: firstIssueMessage(parsed.error) };
    }

    // Only dictionary roles are stored; anything else (e.g. free text from an old backup) is dropped
    const { dictionary, names } = await getRoleCatalog();
    const { roles: validTitles, unrecognized: dropped } = toDesiredRoles(parsed.data, dictionary, names);

    await prisma.$transaction(async (tx) => {
        const existingPositions = await tx.position.findMany({ where: { profileId } });
        const existingTitles = existingPositions.map((position) => position.title);

        const toDelete = existingPositions.filter((position) => !validTitles.includes(position.title));
        if (toDelete.length > 0) {
            await tx.position.deleteMany({
                where: { profileId, id: { in: toDelete.map((position) => position.id) } },
            });
        }

        const toAdd = validTitles.filter((title) => !existingTitles.includes(title));
        if (toAdd.length > 0) {
            await tx.position.createMany({ data: toAdd.map((title) => ({ title, profileId })) });
        }
    });

    return { ok: true, data: { roles: validTitles, dropped } };
}
