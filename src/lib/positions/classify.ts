// Clasificador de títulos de oferta: función pura, sin imports de servidor, para usarla
// igual desde la app, los tests y los scripts de `prisma/dictionary`.
import { MAX_ALIAS_WORDS, aliasKey, tokenizeText, type AliasIndex, type Mention, type TextToken } from "../keywords/core";
import {
    BACKEND_ROLE,
    FRONTEND_ROLE,
    FULL_STACK_ROLE,
    GENERIC_ROLE,
    SENIORITY_TERMS,
    TECH_HINTS,
    TITLE_NOISE,
    WEB_ROLE,
    type Seniority,
} from "./rules";

export interface RoleSource {
    id: string;
    name: string;
    /** Claves de alias (ver aliasKey) con las que el rol aparece dentro de un título. */
    aliasKeys: string[];
}

export interface RoleDictionary {
    /** Alias de rol → id de rol. */
    index: AliasIndex;
    /** Tecnología → id del rol que sugiere. */
    hints: AliasIndex;
    /** Rol genérico: solo aplica cuando no hay nada más específico. */
    genericRoleId: string | null;
    frontendRoleId: string | null;
    backendRoleId: string | null;
    fullStackRoleId: string | null;
    /** Rol amplio de desarrollo web: solo aplica si el título no nombra uno más preciso. */
    webRoleId: string | null;
}

export interface TitleClassification {
    roleId: string | null;
    seniority: Seniority | null;
    /** El título sin seniority ni palabras de relleno, en minúsculas: agrupa títulos parecidos. */
    core: string;
}

export function buildRoleDictionary(roles: RoleSource[]): RoleDictionary {
    const idByName = new Map(roles.map((role) => [role.name, role.id]));

    const index: AliasIndex = new Map();
    for (const role of roles) {
        for (const key of role.aliasKeys) {
            if (key) index.set(key, { keywordId: role.id });
        }
    }

    const hints: AliasIndex = new Map();
    for (const [roleName, technologies] of Object.entries(TECH_HINTS)) {
        const roleId = idByName.get(roleName);
        if (!roleId) continue;
        for (const technology of technologies) {
            hints.set(aliasKey(technology), { keywordId: roleId });
        }
    }

    return {
        index,
        hints,
        genericRoleId: idByName.get(GENERIC_ROLE) ?? null,
        frontendRoleId: idByName.get(FRONTEND_ROLE) ?? null,
        backendRoleId: idByName.get(BACKEND_ROLE) ?? null,
        fullStackRoleId: idByName.get(FULL_STACK_ROLE) ?? null,
        webRoleId: idByName.get(WEB_ROLE) ?? null,
    };
}

const seniorityIndex: AliasIndex = new Map(
    Object.entries(SENIORITY_TERMS).flatMap(([level, terms]) =>
        terms.map((term) => [aliasKey(term), { keywordId: level }] as const)
    )
);

const noiseKeys = new Set(TITLE_NOISE.map(aliasKey));

/**
 * Todas las coincidencias posibles, también las que se solapan. Un título es corto y lo que
 * importa es la frase más específica, esté donde esté: en "Analista QA Automation" tiene
 * que ganar "QA Automation" aunque "Analista QA" empiece antes.
 */
function allMentions(tokens: TextToken[], index: AliasIndex): Mention[] {
    const mentions: Mention[] = [];
    for (let start = 0; start < tokens.length; start++) {
        let key = "";
        for (let size = 1; size <= MAX_ALIAS_WORDS && start + size <= tokens.length; size++) {
            key += tokens[start + size - 1].key;
            const entry = index.get(key);
            if (entry) mentions.push({ keywordId: entry.keywordId, start, size });
        }
    }
    return mentions;
}

/** La coincidencia más larga; si empatan, la que aparece primero. */
function mostSpecific(mentions: Mention[]): Mention | null {
    return mentions.reduce<Mention | null>(
        (best, mention) => (!best || mention.size > best.size ? mention : best),
        null
    );
}

function pickRole(mentions: Mention[], dictionary: RoleDictionary): Mention | null {
    const { frontendRoleId, backendRoleId, fullStackRoleId } = dictionary;
    const ids = new Set(mentions.map((mention) => mention.keywordId));

    // Frontend y backend en el mismo título es un puesto full stack
    if (fullStackRoleId && frontendRoleId && backendRoleId && ids.has(frontendRoleId) && ids.has(backendRoleId)) {
        const first = mentions.find((mention) => mention.keywordId === frontendRoleId || mention.keywordId === backendRoleId)!;
        return { ...first, keywordId: fullStackRoleId };
    }
    return mostSpecific(mentions);
}

/**
 * Deduce el rol y el seniority de un título de oferta.
 *
 * Orden: una frase de rol específica; si no hay, el rol amplio de desarrollo web;
 * si no hay, una tecnología que delate el rol;
 * si no hay, el rol genérico de desarrollo; si tampoco, queda sin clasificar.
 */
export function classifyTitle(title: string, dictionary: RoleDictionary): TitleClassification {
    const tokens = tokenizeText(title);

    const roleMentions = allMentions(tokens, dictionary.index);
    const generic = roleMentions.filter((mention) => mention.keywordId === dictionary.genericRoleId);
    // "Desarrollador Web Full Stack" es full stack y "Desarrollador Web Backend" es backend:
    // el rol web solo decide cuando el título no nombra ninguno más preciso
    const web = roleMentions.filter((mention) => mention.keywordId === dictionary.webRoleId);
    const specific = roleMentions.filter(
        (mention) => mention.keywordId !== dictionary.genericRoleId && mention.keywordId !== dictionary.webRoleId
    );

    const role =
        pickRole(specific, dictionary) ??
        mostSpecific(web) ??
        pickRole(allMentions(tokens, dictionary.hints), dictionary) ??
        mostSpecific(generic);

    // El seniority se busca fuera de la frase de rol: en "Tech Lead", "Lead" es parte del puesto
    const inRole = (position: number) => !!role && position >= role.start && position < role.start + role.size;
    const seniorityMention = mostSpecific(
        allMentions(tokens, seniorityIndex).filter((mention) => !inRole(mention.start))
    );

    const inSeniority = (position: number) =>
        !!seniorityMention && position >= seniorityMention.start && position < seniorityMention.start + seniorityMention.size;

    const core = tokens
        .filter((token, position) => !inSeniority(position) && !noiseKeys.has(token.key))
        .map((token) => token.raw.toLowerCase())
        .join(" ");

    return {
        roleId: role?.keywordId ?? null,
        seniority: (seniorityMention?.keywordId as Seniority | undefined) ?? null,
        core,
    };
}
