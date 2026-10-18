/**
 * Preparación de una postulación antes de que el agente la complete: qué tan bien encaja con
 * el CV y el borrador de la carta de presentación. Funciones puras, sin base ni IA.
 */

/** Porcentaje (0-100) de keywords de la oferta que están en el CV; null si no hay con qué comparar. */
export function computeMatchScore(offerKeywordIds: string[], cvKeywordIds: Iterable<string>): number | null {
    const offer = new Set(offerKeywordIds);
    if (offer.size === 0) return null;
    const cv = new Set(cvKeywordIds);
    if (cv.size === 0) return null;

    let matched = 0;
    for (const id of offer) if (cv.has(id)) matched++;
    return Math.round((matched / offer.size) * 100);
}

// Recortes para que el pedido entre en los modelos gratuitos con contexto chico
const PROMPT_LIMITS = { description: 6_000, cv: 6_000, template: 3_000 } as const;

export interface CoverLetterInput {
    jobTitle: string;
    company?: string | null;
    jobDescription: string;
    cvText: string;
    candidateName?: string | null;
    /** Carta modelo del usuario: se respeta su tono y estructura. */
    template?: string | null;
}

export function buildCoverLetterPrompt(input: CoverLetterInput): string {
    const template = input.template?.trim()
        ? `\nCARTA MODELO DEL CANDIDATO (respetá su tono, estructura y largo; adaptá el contenido a la oferta):
###MODELO###
${input.template.slice(0, PROMPT_LIMITS.template)}
###MODELO###\n`
        : "";

    return `Escribí una carta de presentación para esta postulación.

REGLAS:
- Escribila en el MISMO IDIOMA en que está escrita la oferta.
- Entre 150 y 250 palabras, en 3 o 4 párrafos. Sin asunto, sin fecha, sin direcciones.
- Usá SOLO experiencia y habilidades que aparezcan en el CV. NO inventes empresas, títulos, años ni logros.
- Conectá 2 o 3 requisitos concretos de la oferta con experiencia real del CV.
- Si falta un dato (nombre de la empresa, del reclutador), no uses marcadores como [Empresa]: escribí la frase sin ese dato.
- Firmá con el nombre del candidato${input.candidateName ? ` (${input.candidateName})` : " si aparece en el CV"}.
- Respondé ÚNICAMENTE con el texto de la carta, sin comentarios antes ni después.
${template}
PUESTO: ${input.jobTitle}${input.company ? `\nEMPRESA: ${input.company}` : ""}

###OFERTA###
${input.jobDescription.slice(0, PROMPT_LIMITS.description)}
###OFERTA###

###CV###
${input.cvText.slice(0, PROMPT_LIMITS.cv)}
###CV###`;
}

/**
 * Limpia la respuesta del modelo: saca los bloques de código y las frases de introducción
 * típicas ("Aquí está tu carta:"). Devuelve null si no queda una carta utilizable.
 */
export function cleanCoverLetter(raw: string, maxLength: number): string | null {
    let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const fenced = text.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
    if (fenced) text = fenced[1].trim();

    const lines = text.split("\n");
    // Sin \b: no reconoce el límite de palabra después de una letra con tilde ("aquí")
    if (/^(aqu[ií]|here|claro|sure|por supuesto)(\s.*)?:\s*$/i.test(lines[0]?.trim() ?? "")) {
        text = lines.slice(1).join("\n").trim();
    }

    if (text.length < 200 || /\[(empresa|company|nombre|name)[^\]]*\]/i.test(text)) return null;
    return text.slice(0, maxLength);
}
