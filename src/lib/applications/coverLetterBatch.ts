import "server-only";

import { generateCoverLetterForApplication } from "./coverLetter";

// Margen antes del límite de la función: las cartas que no entran las completa el agente con la carta modelo
const DEFAULT_BUDGET_MS = 240_000;

/**
 * Prepara con la IA gratuita las cartas de varias ofertas recién aprobadas, de a una, sin pisar las
 * que ya existen. Frena al llegar al límite diario de cartas o al acabarse el tiempo de la función.
 */
export async function prepareCoverLetters(
    profileId: string,
    applicationIds: string[],
    budgetMs = DEFAULT_BUDGET_MS
): Promise<{ prepared: number; pending: number }> {
    const started = Date.now();
    let prepared = 0;

    for (const id of applicationIds) {
        if (Date.now() - started >= budgetMs) break;
        const result = await generateCoverLetterForApplication(profileId, id);
        if (result.ok) {
            prepared++;
            continue;
        }
        console.warn(`Cover letter not prepared for ${id}: ${result.code}`);
        if (result.code === "LIMIT_REACHED") break;
    }

    return { prepared, pending: applicationIds.length - prepared };
}
