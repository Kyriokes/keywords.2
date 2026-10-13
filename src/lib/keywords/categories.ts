// Categorías del diccionario. El valor se guarda en `Keyword.category`; el orden es el de la UI.
export const KEYWORD_CATEGORIES = [
    "LENGUAJE",
    "FRAMEWORK",
    "DATOS",
    "CLOUD_DEVOPS",
    "HERRAMIENTA",
    "METODOLOGIA",
    "OTRA",
] as const;

export type KeywordCategory = typeof KEYWORD_CATEGORIES[number];

export const CATEGORY_LABELS: Record<KeywordCategory, string> = {
    LENGUAJE: "Lenguajes",
    FRAMEWORK: "Frameworks y librerías",
    DATOS: "Datos",
    CLOUD_DEVOPS: "Cloud y DevOps",
    HERRAMIENTA: "Herramientas",
    METODOLOGIA: "Metodologías y conceptos",
    OTRA: "Otras",
};

export function isKeywordCategory(value: unknown): value is KeywordCategory {
    return typeof value === "string" && (KEYWORD_CATEGORIES as readonly string[]).includes(value);
}

/** Las keywords sin categoría (por ejemplo, las que todavía no se verificaron) caen en "Otras". */
export function toKeywordCategory(value: string | null | undefined): KeywordCategory {
    return isKeywordCategory(value) ? value : "OTRA";
}
