import rolesSeed from "./roles.json";
import { MAX_ALIAS_WORDS, aliasKey, tokenizeText } from "../../src/lib/keywords/core";
import type { RoleSource } from "../../src/lib/positions/classify";
import {
    BACKEND_ROLE,
    FRONTEND_ROLE,
    FULL_STACK_ROLE,
    GENERIC_ROLE,
    OTHER_ROLE,
    TECH_HINTS,
    WEB_ROLE,
} from "../../src/lib/positions/rules";

export interface SeedRole {
    name: string;
    /** Claves de alias con las que el rol se reconoce dentro de un título. */
    aliasKeys: string[];
}

export const SEED_SECTOR: string = rolesSeed.sector;

export function loadRoles(): SeedRole[] {
    return rolesSeed.roles.map((role) => {
        // El nombre del rol también lo identifica, salvo "Otros": esa palabra en un título no dice nada
        const phrases = role.name === OTHER_ROLE ? role.aliases : [role.name, ...role.aliases];
        return { name: role.name, aliasKeys: Array.from(new Set(phrases.map(aliasKey))) };
    });
}

/** Los roles de la semilla como los espera el clasificador (el nombre hace de id). */
export function seedRoleSources(): RoleSource[] {
    return loadRoles().map((role) => ({ id: role.name, name: role.name, aliasKeys: role.aliasKeys }));
}

/** Errores que harían ambigua o inútil la semilla de roles. Vacío si está bien. */
export function findRoleProblems(roles: SeedRole[]): string[] {
    const problems: string[] = [];
    const names = new Set(roles.map((role) => role.name));

    if (names.size !== roles.length) problems.push("hay nombres de rol repetidos");

    for (const required of [GENERIC_ROLE, FRONTEND_ROLE, BACKEND_ROLE, FULL_STACK_ROLE, WEB_ROLE, OTHER_ROLE, ...Object.keys(TECH_HINTS)]) {
        if (!names.has(required)) problems.push(`falta el rol "${required}", que las reglas usan por nombre`);
    }

    const ownerByAlias = new Map<string, string>();
    for (const role of rolesSeed.roles) {
        for (const phrase of role.aliases) {
            const key = aliasKey(phrase);
            if (!key) {
                problems.push(`"${role.name}": el alias "${phrase}" no tiene clave`);
                continue;
            }
            if (tokenizeText(phrase).length > MAX_ALIAS_WORDS) {
                problems.push(`"${role.name}": "${phrase}" supera ${MAX_ALIAS_WORDS} palabras y no se detectaría`);
            }
            const owner = ownerByAlias.get(key);
            if (owner && owner !== role.name) {
                problems.push(`alias "${phrase}" compartido por "${owner}" y "${role.name}"`);
            }
            ownerByAlias.set(key, role.name);
        }
    }

    return problems;
}
