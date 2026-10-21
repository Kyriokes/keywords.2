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

/** Idioma de un aviso: castellano, inglés u otro (en el que no se postula). */
export type AdLanguage = LetterLanguage | "other";

// Palabras funcionales de otros idiomas que no se confunden con las del castellano ni el inglés
const FOREIGN_STOPWORDS = new Set(
    [
        // alemán
        "und der die das nicht wir sie mit ist ein eine für auf den dem einem einer werden wird",
        // portugués
        "você não são dos das ao nossa nosso também vaga equipe será você conosco",
        // francés
        "les des pour nous vous avec dans une sont est sur notre vos nos",
        // italiano
        "della sono nel delle anche lavoro siamo nostro nostra degli",
    ]
        .join(" ")
        .split(" ")
);

// Griego, cirílico, hebreo, árabe, japonés, chino y coreano
const OTHER_SCRIPTS = /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿ぀-ヿ一-鿿가-힯]/g;
/** Con menos caracteres de otro alfabeto puede ser un nombre o una cita; con más, el aviso está en ese idioma. */
const MIN_SCRIPT_CHARS = 20;
/** Textos más cortos no alcanzan para decidir que están en otro idioma. */
const MIN_WORDS_FOR_FOREIGN = 60;

/**
 * Como `detectLanguage`, pero devuelve "other" cuando el aviso está escrito en un idioma en el que
 * el usuario no postula: otro alfabeto, o más palabras funcionales de alemán, portugués, francés o
 * italiano que de castellano e inglés juntos.
 */
export function detectAdLanguage(text: string): AdLanguage {
    if ((text.match(OTHER_SCRIPTS) ?? []).length >= MIN_SCRIPT_CHARS) return "other";

    const words = text.toLowerCase().match(/[a-záéíóúñüçãõàèìòùäöüß]+/g) ?? [];
    let es = 0;
    let en = 0;
    let foreign = 0;
    for (const word of words) {
        if (STOPWORDS.es.has(word)) es++;
        if (STOPWORDS.en.has(word)) en++;
        if (FOREIGN_STOPWORDS.has(word)) foreign++;
    }
    if (words.length >= MIN_WORDS_FOR_FOREIGN && foreign > es + en) return "other";
    return es > en ? "es" : "en";
}
