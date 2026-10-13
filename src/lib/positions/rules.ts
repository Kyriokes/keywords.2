// Reglas fijas del clasificador de títulos. Los roles y sus alias viven en la base
// (semilla: prisma/dictionary/roles.json); acá va lo que no se edita desde /admin.

export const SENIORITY_LEVELS = ["TRAINEE", "JUNIOR", "SEMI_SENIOR", "SENIOR", "LEAD"] as const;

export type Seniority = typeof SENIORITY_LEVELS[number];

export const SENIORITY_LABELS: Record<Seniority, string> = {
    TRAINEE: "Trainee",
    JUNIOR: "Junior",
    SEMI_SENIOR: "Semi Senior",
    SENIOR: "Senior",
    LEAD: "Lead",
};

export function isSeniority(value: unknown): value is Seniority {
    return typeof value === "string" && (SENIORITY_LEVELS as readonly string[]).includes(value);
}

/** Cómo aparece cada nivel en un título, en español e inglés. */
export const SENIORITY_TERMS: Record<Seniority, string[]> = {
    TRAINEE: ["trainee", "intern", "internship", "pasante", "pasantía", "becario", "becaria", "practicante"],
    JUNIOR: ["junior", "jr", "entry level"],
    SEMI_SENIOR: ["semi senior", "semisenior", "semi sr", "ssr", "mid", "mid level", "middle", "intermedio"],
    SENIOR: ["senior", "sr"],
    LEAD: ["lead", "líder", "principal", "staff"],
};

// Nombres de roles a los que las reglas se refieren. La semilla tiene que incluirlos
// (lo verifica el test de integridad de roles.json).
export const GENERIC_ROLE = "Software Developer";
export const FRONTEND_ROLE = "Frontend Developer";
export const BACKEND_ROLE = "Backend Developer";
export const FULL_STACK_ROLE = "Full Stack Developer";
/** Destino manual para títulos que no corresponden a ningún rol del diccionario. */
export const OTHER_ROLE = "Otros";

/**
 * Tecnologías que delatan el rol cuando el título no lo nombra: "Java Developer" → Backend.
 * Solo se consultan si no hay una frase de rol. JavaScript y TypeScript quedan afuera a
 * propósito: sirven para frontend y backend por igual.
 */
export const TECH_HINTS: Record<string, string[]> = {
    [FRONTEND_ROLE]: ["react", "react.js", "angular", "angularjs", "vue", "vue.js", "next.js", "svelte", "html", "css", "jquery"],
    [BACKEND_ROLE]: [
        "java", "spring", "spring boot", "python", "django", "flask", "fastapi", "node", "node.js", "nestjs",
        "express", "php", "laravel", "symfony", "ruby", "ruby on rails", "rails", "go", "golang", "rust",
        "c#", ".net", "asp.net", "scala", "elixir", "api", "apis", "microservicios", "microservices",
    ],
    "Mobile Developer": ["android", "ios", "react native", "flutter", "swift", "kotlin", "xamarin", "ionic"],
    "Data Engineer": ["spark", "airflow", "etl", "databricks", "snowflake", "big data", "hadoop", "kafka"],
    "AI/ML Engineer": ["machine learning", "ml", "ai", "ia", "llm", "deep learning", "nlp", "genai", "tensorflow", "pytorch"],
    "BI Analyst": ["power bi", "tableau", "looker", "qlik"],
    "DevOps Engineer": ["kubernetes", "docker", "terraform", "ci/cd", "jenkins", "ansible"],
    "Cloud Engineer": ["aws", "azure", "gcp", "google cloud"],
    "Database Administrator": ["oracle", "sql server", "postgresql", "mysql", "pl/sql", "sql"],
    "Game Developer": ["unity", "unreal", "unreal engine"],
    "Blockchain Developer": ["solidity"],
};

/** Palabras del título que no describen el puesto; se quitan para agrupar títulos parecidos. */
export const TITLE_NOISE = [
    "remoto", "remota", "remote", "híbrido", "hibrido", "híbrida", "hybrid", "presencial", "onsite", "on-site",
    "full time", "fulltime", "part time", "parttime", "freelance", "contractor", "temporal", "urgente", "urgent",
    "latam", "argentina", "buenos aires", "caba", "de", "del", "la", "el", "en", "con", "para", "y", "e", "o",
    "a", "and", "or", "of", "the", "in", "for", "with", "at",
];
