import { describe, expect, it } from "vitest";
import { aliasKey, buildTextIndex, matchText, textMentions, tokenizeText, type AliasIndex } from "./core";

function indexOf(entries: Array<[name: string, id: string, exactText?: string]>): AliasIndex {
    return new Map(entries.map(([name, keywordId, exactText]) => [aliasKey(name), { keywordId, exactText }]));
}

describe("aliasKey", () => {
    it("unifica mayúsculas, acentos y separadores", () => {
        expect(aliasKey("Node.js")).toBe("nodejs");
        expect(aliasKey("NodeJS")).toBe("nodejs");
        expect(aliasKey("node js")).toBe("nodejs");
        expect(aliasKey("Front-End")).toBe(aliasKey("front end"));
        expect(aliasKey("Aprendizaje Automático")).toBe(aliasKey("aprendizaje automatico"));
    });

    it("conserva los símbolos que distinguen lenguajes", () => {
        expect(aliasKey("C#")).toBe("c#");
        expect(aliasKey("C++")).toBe("c++");
        expect(aliasKey("C")).toBe("c");
        expect(new Set([aliasKey("C"), aliasKey("C#"), aliasKey("C++")]).size).toBe(3);
    });

    it("trata .NET distinto de la palabra net", () => {
        expect(aliasKey(".NET")).toBe("dotnet");
        expect(aliasKey("dotnet")).toBe("dotnet");
        expect(aliasKey("net")).toBe("net");
        expect(aliasKey("ASP.NET")).toBe("aspnet");
    });

    it("une CI/CD en una sola clave", () => {
        expect(aliasKey("CI/CD")).toBe("cicd");
        expect(aliasKey("ci cd")).toBe("cicd");
    });

    it("devuelve vacío si no hay nada reconocible", () => {
        expect(aliasKey("  ")).toBe("");
        expect(aliasKey("---")).toBe("");
    });
});

describe("tokenizeText", () => {
    it("conserva la escritura original y marca los cortes de frase", () => {
        const tokens = tokenizeText("React, Node.js. Python");
        expect(tokens.map((t) => t.raw)).toEqual(["React", "Node.js", "Python"]);
        expect(tokens.map((t) => t.breakBefore)).toEqual([false, true, true]);
    });

    it("no corta por barra ni por salto de línea", () => {
        const tokens = tokenizeText("CI/CD\nmachine\nlearning");
        expect(tokens.map((t) => t.breakBefore)).toEqual([false, false, false, false]);
    });
});

describe("matchText", () => {
    const index = indexOf([
        ["React", "react"],
        ["React Native", "react-native"],
        ["Node.js", "node"],
        ["SQL", "sql"],
        ["SQL Server", "sql-server"],
        ["Machine Learning", "ml"],
        ["aprendizaje automático", "ml"],
        ["C#", "csharp"],
        ["C++", "cpp"],
        [".NET", "dotnet"],
        ["CI/CD", "cicd"],
        ["Go", "go", "Go"],
        ["golang", "go"],
        ["R", "r", "R"],
    ]);

    const ids = (text: string) => Object.fromEntries(matchText(text, index));

    it("detecta variantes de escritura del mismo término", () => {
        expect(ids("NodeJS, node.js y Node JS")).toEqual({ node: 3 });
    });

    it("prefiere el alias más largo y no solapa", () => {
        expect(ids("Experiencia en React Native y React")).toEqual({ "react-native": 1, react: 1 });
        expect(ids("SQL Server y SQL")).toEqual({ "sql-server": 1, sql: 1 });
    });

    it("unifica español e inglés en la misma keyword", () => {
        expect(ids("Machine Learning / aprendizaje automático")).toEqual({ ml: 2 });
    });

    it("reconoce frases partidas por un salto de línea", () => {
        expect(ids("modelos de machine\nlearning en producción")).toEqual({ ml: 1 });
    });

    it("no une palabras separadas por coma o punto", () => {
        expect(ids("React, Native apps")).toEqual({ react: 1 });
        expect(ids("Uso SQL. Server propio")).toEqual({ sql: 1 });
    });

    it("distingue C, C# y C++ y reconoce .NET y CI/CD", () => {
        expect(ids("C#, C++, .NET y CI/CD")).toEqual({ csharp: 1, cpp: 1, dotnet: 1, cicd: 1 });
    });

    it("exige la capitalización exacta en alias ambiguos", () => {
        expect(ids("Backend en Go y análisis en R")).toEqual({ go: 1, r: 1 });
        expect(ids("let's go to market, r&d")).toEqual({});
        expect(ids("desarrollo en golang")).toEqual({ go: 1 });
    });

    it("no detecta términos dentro de otras palabras", () => {
        expect(ids("reactivos y reaccionar")).toEqual({});
    });
});

describe("textMentions", () => {
    const cv = buildTextIndex("Project Manager con foco en control de calidad. Uso Go y Power BI.");

    it("encuentra keywords de varias palabras como frase contigua", () => {
        expect(textMentions(cv, { aliasText: aliasKey("project manager") })).toBe(true);
        expect(textMentions(cv, { aliasText: aliasKey("Control de Calidad") })).toBe(true);
        expect(textMentions(cv, { aliasText: aliasKey("PowerBI") })).toBe(true);
    });

    it("no da por presente una frase si solo están sus palabras sueltas", () => {
        expect(textMentions(cv, { aliasText: aliasKey("manager de calidad") })).toBe(false);
        expect(textMentions(cv, { aliasText: aliasKey("calidad uso") })).toBe(false);
    });

    it("respeta la capitalización exacta", () => {
        expect(textMentions(cv, { aliasText: "go", exactText: "Go" })).toBe(true);
        expect(textMentions(cv, { aliasText: "r", exactText: "R" })).toBe(false);
    });

    it("no matchea una clave vacía", () => {
        expect(textMentions(cv, { aliasText: "" })).toBe(false);
    });
});
