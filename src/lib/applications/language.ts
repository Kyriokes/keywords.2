/** Idioma de una oferta o de una carta: castellano o inglés, los dos en que se postula. */
export type LetterLanguage = "es" | "en";

export const LANGUAGE_NAMES: Record<LetterLanguage, string> = { es: "castellano", en: "inglés" };

// Palabras funcionales frecuentes: aparecen en cualquier texto y no se confunden con nombres de tecnologías
const STOPWORDS: Record<LetterLanguage, Set<string>> = {
    es: new Set("de la el que y en los las para con una por del se es como al sus tu nuestro nuestra buscamos experiencia".split(" ")),
    en: new Set("the and to of for with you our we is are will on as your be an this that who".split(" ")),
};

/** Idioma en que está escrito un texto, contando palabras funcionales. Sin pistas, inglés. */
export function detectLanguage(text: string): LetterLanguage {
    const words = text.toLowerCase().match(/[a-záéíóúñü]+/g) ?? [];
    let es = 0;
    let en = 0;
    for (const word of words) {
        if (STOPWORDS.es.has(word)) es++;
        if (STOPWORDS.en.has(word)) en++;
    }
    return es > en ? "es" : "en";
}
