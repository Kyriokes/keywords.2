import "server-only";

import prisma from "@/lib/prisma";
import { buildRoleDictionary, classifyTitle, type RoleDictionary } from "./classify";
import type { Seniority } from "./rules";

export interface RoleCatalog {
    dictionary: RoleDictionary;
    /** Nombre de cada rol activo, por id. */
    names: Map<string, string>;
}

// Igual que el diccionario de keywords: en memoria por instancia, con vencimiento corto.
const CACHE_TTL_MS = 60_000;
let cached: { catalog: RoleCatalog; loadedAt: number } | null = null;

export function invalidateRoles() {
    cached = null;
}

export async function getRoleCatalog(): Promise<RoleCatalog> {
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached.catalog;
    }

    const roles = await prisma.canonicalPosition.findMany({
        where: { isActive: true },
        select: { id: true, name: true, aliases: { select: { aliasText: true } } },
    });

    const catalog: RoleCatalog = {
        dictionary: buildRoleDictionary(
            roles.map((role) => ({
                id: role.id,
                name: role.name,
                aliasKeys: role.aliases.map((alias) => alias.aliasText),
            }))
        ),
        names: new Map(roles.map((role) => [role.id, role.name])),
    };

    cached = { catalog, loadedAt: Date.now() };
    return catalog;
}

export interface ClassifiedTitle {
    roleId: string | null;
    roleName: string | null;
    seniority: Seniority | null;
    core: string;
}

/** Rol y seniority de un título de oferta según el diccionario de roles. */
export async function classifyJobTitle(title: string): Promise<ClassifiedTitle> {
    const { dictionary, names } = await getRoleCatalog();
    const classified = classifyTitle(title, dictionary);
    return { ...classified, roleName: classified.roleId ? names.get(classified.roleId) ?? null : null };
}
