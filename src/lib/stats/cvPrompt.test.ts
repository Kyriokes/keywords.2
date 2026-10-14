import { describe, expect, it } from "vitest";
import { MAX_PROMPT_CV_CHARS, MAX_PROMPT_SKILLS, buildCvPrompt } from "./cvPrompt";
import { summarizeKeywords, type InsightKeyword } from "./keywordAnalysis";

const keyword = (name: string, inCv: boolean, verified = true): InsightKeyword => ({
  id: name,
  name,
  category: "FRAMEWORK",
  verified,
  inCv,
});

const keywords = [keyword("React", true), keyword("TypeScript", true), keyword("Next.js", false), keyword("Docker", false), keyword("Vercelito", false, false)];
const byApplication = {
  a: ["React", "TypeScript", "Next.js", "Docker", "Vercelito"],
  b: ["React", "Next.js"],
  c: ["React", "TypeScript"],
};

const summarize = (options: { hidden?: string[]; simulated?: string[]; includeUnverified?: boolean } = {}) =>
  summarizeKeywords({
    keywords,
    byApplication,
    applicationIds: ["a", "b", "c"],
    hiddenIds: new Set(options.hidden),
    simulatedIds: new Set(options.simulated),
    includeUnverified: options.includeUnverified,
  });

const base = { roles: ["Frontend Developer"], levels: ["Senior"], cvText: "Desarrollador con React y TypeScript.", includeCv: true };

describe("buildCvPrompt", () => {
  it("arma el pedido con contexto, lo que tengo, lo que falta, reglas y el CV", () => {
    const prompt = buildCvPrompt({ ...base, summary: summarize() });

    expect(prompt).toContain("Me estoy postulando a: Frontend Developer (Senior).");
    expect(prompt).toContain("Analicé 3 ofertas.");
    expect(prompt).toContain("- React (lo piden 3 de 3)");
    expect(prompt).toContain("- Next.js: lo piden 2 de 3, sumaría");
    expect(prompt).toContain("No inventes experiencia");
    expect(prompt).toContain("## Mi CV\n\nDesarrollador con React y TypeScript.");
    expect(prompt).not.toContain("## Lo que quiero priorizar");
  });

  it("pone primero lo que el usuario tildó en la simulación", () => {
    const prompt = buildCvPrompt({ ...base, summary: summarize({ simulated: ["Docker"] }) });
    expect(prompt).toContain("## Lo que quiero priorizar\n- Docker");
  });

  it("no menciona lo que el usuario sacó del cálculo ni lo sin verificar si lo excluyó", () => {
    const prompt = buildCvPrompt({ ...base, summary: summarize({ hidden: ["TypeScript", "Docker"], includeUnverified: false }) });
    expect(prompt).not.toContain("TypeScript (");
    expect(prompt).not.toContain("Docker");
    expect(prompt).not.toContain("Vercelito");
  });

  it("sin la casilla no copia el CV y le pide a la IA que lo solicite", () => {
    const prompt = buildCvPrompt({ ...base, includeCv: false, summary: summarize() });
    expect(prompt).not.toContain("## Mi CV");
    expect(prompt).toContain("pedímelo antes de proponer cambios");
  });

  it("sin CV arma un pedido para crearlo desde cero", () => {
    const prompt = buildCvPrompt({ ...base, cvText: "  ", summary: summarize() });
    expect(prompt).toContain("# Ayudame a armar mi CV");
    expect(prompt).not.toContain("Lo que ya tengo");
    expect(prompt).not.toContain("## Mi CV");
  });

  it("recorta las listas largas y el CV, avisando", () => {
    const many = Array.from({ length: MAX_PROMPT_SKILLS + 3 }, (_, index) => keyword(`Herramienta ${index}`, false));
    const summary = summarizeKeywords({ keywords: many, byApplication: { a: many.map((item) => item.id) }, applicationIds: ["a"] });
    const prompt = buildCvPrompt({ ...base, cvText: "§".repeat(MAX_PROMPT_CV_CHARS + 50), summary });

    expect(prompt).toContain("- (y 3 más con menos demanda)");
    expect(prompt).toContain("lo recorté a 15.000 caracteres");
    expect(prompt.match(/§/g)?.length).toBe(MAX_PROMPT_CV_CHARS);
  });
});
