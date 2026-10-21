// Dónde dice la oferta qué pide: la sección de requisitos. Funciones puras, sin diccionario.

/** Encabezados con los que las ofertas presentan los requisitos, en inglés y en castellano. */
const REQUIREMENTS_HEADING =
    /\b(requirements?|requisitos|must[- ]haves?|what you.?ll need|what you need|what you bring|qualifications|what we.?re looking for|who you are|about you|perfil buscado|lo que buscamos|que buscamos|skills? (?:required|needed)|tecnolog[ií]as requeridas|conocimientos (?:requeridos|excluyentes)|excluyentes?)\b/i;

/** Después del encabezado, lo que entra en la sección antes de que empiecen los beneficios. */
const SECTION_LENGTH = 1_500;

/**
 * El tramo de la descripción que lista los requisitos (hasta 1.500 caracteres después del encabezado),
 * o vacío si la oferta no separa una sección así. Lo que se nombra ahí es lo que de verdad piden.
 */
export function requirementsSection(description: string): string {
    const match = REQUIREMENTS_HEADING.exec(description);
    if (!match) return "";
    return description.slice(match.index, match.index + SECTION_LENGTH);
}
