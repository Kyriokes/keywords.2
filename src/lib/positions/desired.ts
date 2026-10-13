import { classifyTitle, type RoleDictionary } from "./classify";
import { OTHER_ROLE } from "./rules";

export interface DesiredRoles {
    /** Nombres de rol del diccionario, sin repetir y en el orden en que llegaron. */
    roles: string[];
    /** Textos que no corresponden a ningún rol. */
    unrecognized: string[];
}

/**
 * Convierte puestos deseados a roles del diccionario. Un nombre de rol exacto se conserva;
 * un texto libre guardado antes del diccionario ("Desarrollador React Sr") se clasifica como
 * si fuera el título de una oferta.
 */
export function toDesiredRoles(
    titles: string[],
    dictionary: RoleDictionary,
    roleNames: ReadonlyMap<string, string>
): DesiredRoles {
    const byLowerName = new Map(Array.from(roleNames.values(), (name) => [name.toLowerCase(), name]));

    const roles = new Set<string>();
    const unrecognized: string[] = [];

    for (const title of titles) {
        const trimmed = title.trim();
        if (!trimmed) continue;

        const classifiedId = classifyTitle(trimmed, dictionary).roleId;
        const name = byLowerName.get(trimmed.toLowerCase()) ?? (classifiedId ? roleNames.get(classifiedId) : undefined);

        // "Otros" es un destino de moderación, no un puesto que alguien busque
        if (name && name !== OTHER_ROLE) {
            roles.add(name);
        } else {
            unrecognized.push(trimmed);
        }
    }

    return { roles: Array.from(roles), unrecognized };
}
