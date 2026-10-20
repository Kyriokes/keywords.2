/**
 * Preparación de una postulación antes de que el agente la complete: qué tan bien encaja con
 * el CV y el borrador de la carta de presentación. Funciones puras, sin base ni IA.
 */
import { AI_TELLS, WRITING_GUIDE } from "./voice";

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
    /** Muletillas que tuvo la versión anterior: se pide reescribirla sin ellas. */
    avoid?: string[];
}

export function buildCoverLetterPrompt(input: CoverLetterInput): string {
    // La carta modelo aporta datos de la experiencia; su tono suele ser más formal del que se busca
    const template = input.template?.trim()
        ? `\nCARTA MODELO DEL CANDIDATO (usala solo como fuente de datos sobre su experiencia; NO copies su formalidad, su saludo ni su largo):
###MODELO###
${input.template.slice(0, PROMPT_LIMITS.template)}
###MODELO###\n`
        : "";
    // Segundo intento: se nombran las muletillas que tuvo la primera versión
    const avoid = input.avoid?.length
        ? `\n- La versión anterior usó: ${input.avoid.join(", ")}. Reescribila sin esas frases ni equivalentes.`
        : "";
    const greeting = input.company
        ? `"Hola equipo de ${input.company}," (en inglés: "Hi ${input.company} team,")`
        : `"Hola," (en inglés: "Hi,")`;

    return `Escribí una carta de presentación breve para esta postulación, como la escribiría el candidato en un mail a una persona.

REGLAS:
- Escribila en el MISMO IDIOMA en que está escrita la oferta.
- Entre 80 y 130 palabras, en 2 o 3 párrafos cortos.
- Sin título, sin asunto, sin fecha, sin direcciones ni encabezados.
- Empezá con un saludo simple: ${greeting}.
- Usá SOLO experiencia y habilidades que aparezcan en el CV. NO inventes empresas, títulos, años ni logros.
- Conectá 1 o 2 requisitos concretos de la oferta con experiencia real del CV.
- Si falta un dato (nombre de la empresa, del reclutador), no uses marcadores como [Empresa]: escribí la frase sin ese dato.
- Cerrá con una frase corta (por ejemplo, que te gustaría charlar) y el nombre del candidato${input.candidateName ? ` (${input.candidateName})` : " si aparece en el CV"}.
- Respondé ÚNICAMENTE con el texto de la carta, sin comentarios antes ni después.

CÓMO ESCRIBIR:
${WRITING_GUIDE}
- No uses estas frases ni parecidas: ${AI_TELLS.map((tell) => tell.label).join(", ")}.${avoid}
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

    // Títulos y asunto que algunos modelos agregan aunque se les pida que no
    const TITLE = /^(#+\s.*|\*\*[^*]+\*\*|(carta de presentaci[oó]n|cover letter|asunto|subject)(\s.*|:.*)?)$/i;
    let rest = text.split("\n");
    while (rest.length && (TITLE.test(rest[0].trim()) || !rest[0].trim())) rest = rest.slice(1);
    text = rest.join("\n").trim();

    if (text.length < 200 || /\[(empresa|company|nombre|name)[^\]]*\]/i.test(text)) return null;
    return text.slice(0, maxLength);
}
