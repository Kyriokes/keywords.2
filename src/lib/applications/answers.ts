// Qué respuestas enviadas sirven como "última adaptación" de una plantilla.

/** Menos que esto es una opción elegida en un desplegable ("Yes", "Other", "$25,000 - $30,000"), no un texto adaptado. */
const MIN_WORDS = 4;
const MIN_CHARS = 25;

/** Una respuesta adaptada de verdad: un texto, no la opción de una lista. */
export function isAdaptedText(answer: string): boolean {
    const text = answer.trim();
    return text.length >= MIN_CHARS && text.split(/\s+/).length >= MIN_WORDS;
}

/**
 * La última respuesta adaptada de cada plantilla, para no contradecir lo que ya se envió.
 * Recibe las respuestas de más nueva a más vieja y saltea las que son solo una opción elegida.
 */
export function latestAdaptedByTemplate(answers: { templateId: string | null; answer: string }[]): Map<string, string> {
    const latest = new Map<string, string>();
    for (const answer of answers) {
        if (!answer.templateId || latest.has(answer.templateId) || !isAdaptedText(answer.answer)) continue;
        latest.set(answer.templateId, answer.answer);
    }
    return latest;
}
