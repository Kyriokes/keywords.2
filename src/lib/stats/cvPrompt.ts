import type { KeywordStat, KeywordSummary } from "./keywordAnalysis";

// Arma el pedido que el usuario pega en un chat de IA para mejorar su CV. La app no reescribe
// el CV: le da a un modelo más potente el contexto que ya calculó, con reglas para que no
// invente experiencia.

/** Habilidades por lista: más allá de esto el pedido se vuelve ruido. */
export const MAX_PROMPT_SKILLS = 20;
/** Largo máximo del CV que se incluye, para que entre en cualquier chat. */
export const MAX_PROMPT_CV_CHARS = 15_000;

export interface CvPromptInput {
  summary: KeywordSummary;
  /** Puestos que están en el análisis. */
  roles: string[];
  /** Niveles que están en el análisis. */
  levels: string[];
  /** Texto del CV activo; vacío si no hay CV. */
  cvText?: string;
  includeCv: boolean;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

const pointsLabel = (points: number) => {
  const rounded = Math.round(points);
  return rounded >= 1 ? `sumaría ${rounded} ${plural(rounded, "punto", "puntos")}` : "suma menos de 1 punto";
};

/** Lista con tope y una línea que dice cuántas quedaron afuera. */
function list(items: KeywordStat[], line: (item: KeywordStat) => string): string[] {
  const shown = items.slice(0, MAX_PROMPT_SKILLS).map((item) => `- ${line(item)}`);
  const rest = items.length - shown.length;
  return rest > 0 ? [...shown, `- (y ${rest} más con menos demanda)`] : shown;
}

export function buildCvPrompt({ summary, roles, levels, cvText = "", includeCv }: CvPromptInput): string {
  const total = summary.totalApplications;
  const demand = (stat: KeywordStat) => `lo piden ${stat.demand} de ${total}`;

  // Solo lo que cuenta en el cálculo: lo que el usuario sacó vale 0 puntos y no se menciona
  const have = summary.stats.filter((stat) => stat.inCv && stat.points > 0);
  const gaps = summary.gaps;
  const priorities = gaps.filter((stat) => stat.simulated);

  const cv = cvText.trim();
  const hasCv = cv.length > 0;
  const withCv = includeCv && hasCv;

  const lines: string[] = [hasCv ? "# Ayudame a mejorar mi CV para estas búsquedas" : "# Ayudame a armar mi CV para estas búsquedas", ""];

  if (roles.length > 0) {
    lines.push(`Me estoy postulando a: ${roles.join(", ")}${levels.length > 0 ? ` (${levels.join(", ")})` : ""}.`);
  }
  lines.push(
    hasCv
      ? `Analicé ${total} ${plural(total, "oferta", "ofertas")}. Mi CV cubre el ${summary.coverage}% de lo que piden, ponderado por cuántas ofertas piden cada habilidad.`
      : `Analicé ${total} ${plural(total, "oferta", "ofertas")} y todavía no tengo un CV armado.`
  );

  if (hasCv && have.length > 0) {
    lines.push("", "## Lo que ya tengo y conviene destacar", ...list(have, (stat) => `${stat.name} (${demand(stat)})`));
  }

  if (gaps.length > 0) {
    lines.push(
      "",
      hasCv ? "## Lo que me falta, de lo que más suma a lo que menos" : "## Lo que piden las ofertas, de lo más pedido a lo menos",
      ...list(gaps, (stat) => (hasCv ? `${stat.name}: ${demand(stat)}, ${pointsLabel(stat.points)}` : `${stat.name}: ${demand(stat)}`))
    );
  }

  if (priorities.length > 0) {
    lines.push("", "## Lo que quiero priorizar", `- ${priorities.map((stat) => stat.name).join(", ")}`);
  }

  lines.push("", "## Cómo quiero que me ayudes");
  if (hasCv) {
    lines.push(
      "1. No inventes experiencia. Si una habilidad que me falta no aparece en mi CV, preguntame si la tengo antes de sumarla.",
      "2. Para las que sí tengo, proponé cómo hacerlas visibles usando el mismo nombre que usan las ofertas.",
      "3. Sugerí cambios concretos por sección, mostrando el antes y el después.",
      "4. Para las que no tengo, decime cuáles valen la pena aprender primero y una forma rápida de demostrarlas, como un proyecto o un curso."
    );
    if (!withCv) lines.push("5. Todavía no te pasé mi CV: pedímelo antes de proponer cambios.");
  } else {
    lines.push(
      "1. No inventes experiencia. Preguntame qué hice y qué sé antes de escribir nada.",
      "2. Con mis respuestas, ayudame a armar un CV que use los mismos nombres que usan las ofertas.",
      "3. Para lo que no sé, decime qué conviene aprender primero y una forma rápida de demostrarlo."
    );
  }

  if (withCv) {
    const clipped = cv.length > MAX_PROMPT_CV_CHARS;
    lines.push("", "## Mi CV", "", cv.slice(0, MAX_PROMPT_CV_CHARS));
    if (clipped) lines.push("", `(El CV sigue, pero lo recorté a ${MAX_PROMPT_CV_CHARS.toLocaleString("es-AR")} caracteres.)`);
  }

  return lines.join("\n");
}
