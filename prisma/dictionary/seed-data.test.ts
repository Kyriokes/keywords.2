import { describe, expect, it } from "vitest";
import { findSeedProblems, loadSeed } from "./seed-data";
import { matchText, type AliasIndex } from "../../src/lib/keywords/core";

const seed = loadSeed();

function seedIndex(): AliasIndex {
    const index: AliasIndex = new Map();
    for (const entry of seed) {
        for (const alias of entry.aliases) {
            index.set(alias.aliasText, { keywordId: entry.name, exactText: alias.exactText });
        }
    }
    return index;
}

describe("semilla del diccionario", () => {
    it("no tiene alias compartidos, nombres repetidos ni categorías inválidas", () => {
        expect(findSeedProblems(seed)).toEqual([]);
    });

    it("reconoce las tecnologías de una oferta real escrita en español e inglés", () => {
        const offer = `
            Buscamos Desarrollador/a Full Stack Sr. con experiencia en React.js, NodeJS y TypeScript.
            Requisitos: bases de datos relacionales (PostgreSQL), APIs REST, integración continua,
            Docker y Kubernetes sobre AWS. Deseable: aprendizaje automático, metodologías ágiles (Scrum)
            e inglés avanzado. We value teamwork and unit testing with Jest.
        `;
        const found = new Set(matchText(offer, seedIndex()).keys());

        for (const expected of [
            "Full Stack", "React", "Node.js", "TypeScript", "Bases de datos relacionales", "PostgreSQL",
            "API REST", "CI/CD", "Docker", "Kubernetes", "AWS", "Machine Learning",
            "Metodologías ágiles", "Scrum", "Inglés", "Trabajo en equipo", "Pruebas unitarias", "Jest",
        ]) {
            expect(found, `falta ${expected}`).toContain(expected);
        }
    });

    it("no confunde palabras comunes con tecnologías", () => {
        const prose = "We go the extra mile to excel at our work, express ideas clearly and rest well. " +
            "El resto del equipo va a reaccionar rápido ante el cambio de la primavera (spring).";
        expect(Array.from(matchText(prose, seedIndex()).keys())).toEqual([]);
    });
});
