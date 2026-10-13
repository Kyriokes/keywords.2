// Datos de ejemplo de la landing: una búsqueda frontend inventada, pero procesada como lo haría
// el producto. `sample-data.test.ts` pasa todo por el diccionario y el clasificador reales, así
// la landing no puede mostrar una detección o un rol que la app no daría.
import type { KeywordCategory } from "@/lib/keywords/categories";
import type { Seniority } from "@/lib/positions/rules";
import { matchByApplication, summarizeKeywords, type InsightKeyword } from "@/lib/stats/keywordAnalysis";

const keyword = (name: string, category: KeywordCategory, inCv: boolean): InsightKeyword => ({
  id: name,
  name,
  category,
  verified: true,
  inCv,
});

export const SAMPLE_KEYWORDS: InsightKeyword[] = [
  keyword("React", "FRAMEWORK", true),
  keyword("TypeScript", "LENGUAJE", true),
  keyword("JavaScript", "LENGUAJE", true),
  keyword("HTML", "LENGUAJE", true),
  keyword("CSS", "LENGUAJE", true),
  keyword("Tailwind CSS", "FRAMEWORK", true),
  keyword("Git", "HERRAMIENTA", true),
  keyword("Scrum", "METODOLOGIA", true),
  keyword("Next.js", "FRAMEWORK", false),
  keyword("Node.js", "FRAMEWORK", false),
  keyword("GraphQL", "FRAMEWORK", false),
  keyword("Jest", "HERRAMIENTA", false),
  keyword("Cypress", "HERRAMIENTA", false),
  keyword("Docker", "CLOUD_DEVOPS", false),
  keyword("AWS", "CLOUD_DEVOPS", false),
  keyword("CI/CD", "CLOUD_DEVOPS", false),
  keyword("PostgreSQL", "DATOS", false),
];

/** La oferta que se muestra en "Cómo funciona", con lo que el diccionario detecta en ella. */
export const SAMPLE_OFFER = {
  title: "React Engineer Ssr (Remoto)",
  text: "Buscamos una persona con experiencia en ReactJS y TS para sumarse al equipo de producto. Vas a trabajar con NextJS y GraphQL, escribir tests con Jest y desplegar con Docker sobre AWS. Usamos Git y Scrum.",
  /** En orden de aparición: cómo está escrito en la oferta y con qué nombre se guarda. */
  detected: [
    { written: "ReactJS", name: "React" },
    { written: "TS", name: "TypeScript" },
    { written: "NextJS", name: "Next.js" },
    { written: "GraphQL", name: "GraphQL" },
    { written: "Jest", name: "Jest" },
    { written: "Docker", name: "Docker" },
    { written: "AWS", name: "AWS" },
    { written: "Git", name: "Git" },
    { written: "Scrum", name: "Scrum" },
  ],
};

export interface SampleApplication {
  id: string;
  /** Título tal como lo publicó la empresa. */
  title: string;
  role: string;
  seniority: Seniority | null;
  keywords: string[];
}

const application = (
  title: string,
  role: string,
  seniority: Seniority | null,
  keywords: string[]
): Omit<SampleApplication, "id"> => ({ title, role, seniority, keywords });

export const SAMPLE_APPLICATIONS: SampleApplication[] = [
  application(SAMPLE_OFFER.title, "Frontend Developer", "SEMI_SENIOR", SAMPLE_OFFER.detected.map((item) => item.name)),
  application("Desarrollador/a Frontend Sr", "Frontend Developer", "SENIOR", ["React", "TypeScript", "JavaScript", "Next.js", "Jest", "CSS", "Git", "CI/CD"]),
  application("Frontend Developer React", "Frontend Developer", null, ["React", "JavaScript", "Next.js", "HTML", "CSS", "Tailwind CSS", "Git"]),
  application("UI Developer Semi Senior", "Frontend Developer", "SEMI_SENIOR", ["React", "TypeScript", "CSS", "HTML", "Tailwind CSS", "Jest", "Scrum"]),
  application("Ingeniero de Software Frontend", "Frontend Developer", null, ["React", "TypeScript", "JavaScript", "Next.js", "GraphQL", "Docker", "Git", "Scrum"]),
  application("Full Stack Developer", "Full Stack Developer", null, ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS", "Git", "CI/CD"]),
  application("Programador Web Jr", "Web Developer", "JUNIOR", ["JavaScript", "HTML", "CSS", "Git", "React"]),
  application("Frontend Developer Semi Senior", "Frontend Developer", "SEMI_SENIOR", ["React", "TypeScript", "Next.js", "Tailwind CSS", "Jest", "Cypress", "Git"]),
  application("Desarrollador Full Stack Jr", "Full Stack Developer", "JUNIOR", ["React", "JavaScript", "Node.js", "PostgreSQL", "Docker", "Scrum"]),
  application("React Developer", "Frontend Developer", null, ["React", "TypeScript", "JavaScript", "Next.js", "Jest", "AWS", "CI/CD"]),
  application("Frontend Engineer Sr", "Frontend Developer", "SENIOR", ["React", "TypeScript", "Next.js", "GraphQL", "Jest", "Docker", "AWS", "CI/CD", "Cypress"]),
  application("Full Stack Engineer", "Full Stack Developer", null, ["JavaScript", "TypeScript", "Node.js", "React", "PostgreSQL", "Docker", "Git", "HTML", "CSS"]),
  application("Frontend Developer Jr", "Frontend Developer", "JUNIOR", ["React", "JavaScript", "HTML", "CSS", "Git", "Scrum", "Tailwind CSS"]),
  application("Software Engineer Frontend Ssr", "Frontend Developer", "SEMI_SENIOR", ["React", "TypeScript", "Next.js", "Node.js", "GraphQL", "Jest", "AWS", "Scrum"]),
].map((item, index) => ({ id: `ejemplo-${index + 1}`, ...item }));

export const SAMPLE_APPLICATION_IDS = SAMPLE_APPLICATIONS.map((item) => item.id);

export const SAMPLE_BY_APPLICATION: Record<string, string[]> = Object.fromEntries(
  SAMPLE_APPLICATIONS.map((item) => [item.id, item.keywords])
);

/** El resumen y las coincidencias, calculados con las mismas funciones que usa Estadísticas. */
export const SAMPLE_INPUT = {
  keywords: SAMPLE_KEYWORDS,
  byApplication: SAMPLE_BY_APPLICATION,
  applicationIds: SAMPLE_APPLICATION_IDS,
};

export const SAMPLE_SUMMARY = summarizeKeywords(SAMPLE_INPUT);

export const SAMPLE_MATCHES = matchByApplication(SAMPLE_KEYWORDS, SAMPLE_BY_APPLICATION);
