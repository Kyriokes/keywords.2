// Cómo tienen que sonar las cartas y las respuestas: como una persona, no como una IA.

/** Cómo escribir cartas y respuestas. Lo leen la IA gratuita (prompt de la carta) y Claude (get_candidate.writingGuide). */
export const WRITING_GUIDE = `Escribí como una persona que manda un mail, no como un comunicado ni como un CV.
- Primera persona, frases cortas, una idea por frase. En inglés usá contracciones (I'm, I've).
- Concreto: nombrá un trabajo o proyecto real con un detalle (qué hacía, con qué tecnología, para quién). Nada de "amplia experiencia" ni de listas de tecnologías: como mucho tres, y solo si la oferta las pide.
- Algo específico de la oferta o la empresa (su producto, su stack, el problema que describen), no "su innovadora empresa".
- Sin adjetivos sobre vos (apasionado, proactivo, detallista) y sin fórmulas de carta: ni "me dirijo a ustedes", ni "estimado", ni "I am writing to", ni "I'm thrilled", ni "leverage", ni "fast-paced", ni "I look forward to hearing from you".
- Sin viñetas ni títulos en un texto corto.
- Largo según el lugar: en un campo corto, una o dos frases; en un cuadro de texto, hasta 80 palabras; en una carta, entre 80 y 130.
- En el idioma del formulario o la oferta. Los datos (sueldo, fechas, visa, años, lugar) se copian de la plantilla sin cambiarlos.
- Cerrá con una frase corta y directa; no hace falta despedida formal.`;

/** Frases que un reclutador reconoce como escritas por una IA o por una plantilla de carta. */
export const AI_TELLS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
    { label: "me dirijo a ustedes", pattern: /\bme dirijo a (ustedes|usted|vosotros)\b/i },
    { label: "estimado/a", pattern: /\bestimad[oa]s?\b/i },
    { label: "por medio de la presente", pattern: /\bpor (medio|intermedio) de la presente\b/i },
    { label: "a quien corresponda", pattern: /\ba quien corresponda\b|\bto whom it may concern\b/i },
    { label: "sería un honor/placer", pattern: /\bser[ií]a un (honor|placer)\b/i },
    { label: "quedo a disposición", pattern: /\bquedo a (su |tu |la )?disposici[oó]n\b/i },
    { label: "no dudes en contactarme", pattern: /\bno dud(e|es|en) en (contactarme|escribirme)\b/i },
    { label: "apasionado/a", pattern: /\bapasionad[oa]s?\b/i },
    { label: "proactivo/a", pattern: /\bproactiv[oa]s?\b/i },
    { label: "amplia experiencia", pattern: /\bamplia experiencia\b/i },
    { label: "Dear Hiring Manager", pattern: /\bdear (hiring|recruiting) (manager|team)\b/i },
    { label: "I am writing to", pattern: /\bI(?:'m| am) writing to\b/i },
    { label: "I am thrilled/excited", pattern: /\bI(?:'m| am) (thrilled|excited|eager|delighted)\b/i },
    { label: "excited to", pattern: /\bexcited to\b/i },
    { label: "passionate", pattern: /\bpassionate\b/i },
    { label: "leverage", pattern: /\bleverag(e|es|ed|ing)\b/i },
    { label: "cutting-edge", pattern: /\bcutting[- ]edge\b/i },
    { label: "fast-paced", pattern: /\bfast[- ]paced\b/i },
    { label: "dynamic team", pattern: /\bdynamic (team|environment)\b/i },
    { label: "proven track record", pattern: /\bproven track record\b/i },
    { label: "I would be a great fit", pattern: /\b(I would|I'd) be a (great|perfect|strong) fit\b/i },
    { label: "I look forward to hearing from you", pattern: /\bI look forward to hearing from you\b/i },
    { label: "seamless", pattern: /\bseamless(ly)?\b/i },
    { label: "robust", pattern: /\brobust\b/i },
    { label: "synergy", pattern: /\bsynerg(y|ies|istic)\b/i },
    { label: "delve", pattern: /\bdelv(e|ing)\b/i },
    { label: "in today's", pattern: /\bin today'?s\b/i },
];

/** Etiquetas de las muletillas que aparecen en el texto, sin repetir, en el orden en que aparecen por primera vez. */
export function findAiTells(text: string): string[] {
    return AI_TELLS.map((tell) => ({ label: tell.label, index: text.search(tell.pattern) }))
        .filter((found) => found.index >= 0)
        .sort((a, b) => a.index - b.index)
        .map((found) => found.label);
}
