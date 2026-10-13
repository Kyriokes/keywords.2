import { describe, expect, it } from "vitest";
import { loadSeed } from "../../../prisma/dictionary/seed-data";
import type { AliasIndex } from "./core";
import { suggestMergeTargets, type MergeTarget } from "./suggest";

// Diccionario armado con la semilla real; el nombre hace de id
const index: AliasIndex = new Map();
const keywords = new Map<string, MergeTarget>();
for (const entry of loadSeed()) {
    keywords.set(entry.name, { id: entry.name, name: entry.name });
    for (const alias of entry.aliases) {
        index.set(alias.aliasText, { keywordId: entry.name, exactText: alias.exactText });
    }
}

const suggest = (term: string) => {
    const { sameAs, similar } = suggestMergeTargets(term, { index, keywords });
    return { sameAs: sameAs?.name ?? null, similar: similar.map((target) => target.name) };
};

describe("suggestMergeTargets", () => {
    it("reconoce un término que el diccionario ya tiene como alias, aunque esté en minúsculas", () => {
        // "AI" es un alias de escritura exacta en texto libre; como término suelto vale igual
        expect(suggest("ai")).toEqual({ sameAs: "Inteligencia Artificial", similar: [] });
        expect(suggest("AI")).toEqual({ sameAs: "Inteligencia Artificial", similar: [] });
        expect(suggest("reactjs").sameAs).toBe("React");
        expect(suggest("golang").sameAs).toBe("Go");
    });

    it("no propone entradas que solo contienen las letras de un término corto", () => {
        const { similar } = suggest("ai");
        expect(similar).not.toContain("OpenAI");
        expect(similar).not.toContain("Apache Airflow");
        expect(similar).not.toContain("Tailwind CSS");
    });

    it("propone las entradas mencionadas dentro del término", () => {
        expect(suggest("experiencia en React")).toEqual({ sameAs: null, similar: ["React"] });
        expect(suggest("react js developer").similar).toContain("React");
    });

    it("propone entradas de nombre parecido", () => {
        expect(suggest("postgre").similar).toContain("PostgreSQL");
        expect(suggest("desarrollo").similar).toEqual(["Desarrollo web", "Desarrollo mobile"]);
    });

    it("no inventa sugerencias para términos que no están en el diccionario", () => {
        for (const term of ["freelance", "clases", "compromiso", "calidad", "ninja"]) {
            expect(suggest(term), term).toEqual({ sameAs: null, similar: [] });
        }
    });

    it("no repite como parecida la entrada que ya es el mismo término", () => {
        const { sameAs, similar } = suggest("Docker");
        expect(sameAs).toBe("Docker");
        expect(similar).not.toContain("Docker");
    });
});
