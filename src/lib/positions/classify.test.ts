import { describe, expect, it } from "vitest";
import { findRoleProblems, loadRoles, seedRoleSources } from "../../../prisma/dictionary/roles-data";
import { buildRoleDictionary, classifyTitle } from "./classify";

// Diccionario armado con la semilla real; el nombre del rol hace de id
const dictionary = buildRoleDictionary(seedRoleSources());
const classify = (title: string) => {
    const { roleId, seniority } = classifyTitle(title, dictionary);
    return [roleId, seniority];
};

describe("semilla de roles", () => {
    it("no tiene alias compartidos y define los roles que usan las reglas", () => {
        expect(findRoleProblems(loadRoles())).toEqual([]);
    });
});

describe("classifyTitle", () => {
    // [título, rol esperado, seniority esperado]
    const cases: Array<[string, string | null, string | null]> = [
        // Frase de rol, en español e inglés
        ["Frontend Developer", "Frontend Developer", null],
        ["Desarrollador/a Frontend Sr", "Frontend Developer", "SENIOR"],
        ["Front-End Engineer (Remote)", "Frontend Developer", null],
        ["Senior Front End Developer - LATAM", "Frontend Developer", "SENIOR"],
        ["Backend Developer Semi Senior", "Backend Developer", "SEMI_SENIOR"],
        ["Desarrollador Back End Jr.", "Backend Developer", "JUNIOR"],
        ["Full Stack Developer (React + Node)", "Full Stack Developer", null],
        ["Fullstack Engineer Ssr", "Full Stack Developer", "SEMI_SENIOR"],
        ["Programador Web Junior", "Web Developer", "JUNIOR"],
        // "Web" acompaña a un rol más preciso: gana el preciso
        ["Desarrollador/a Web Full Stack", "Full Stack Developer", null],
        ["Programador Web Fullstack Jr", "Full Stack Developer", "JUNIOR"],
        ["Desarrollador Web Backend", "Backend Developer", null],
        ["Web Developer Frontend", "Frontend Developer", null],
        // Una tecnología sola no le gana al rol web nombrado en el título
        ["Programador Web PHP", "Web Developer", null],
        ["Desarrollador Mobile", "Mobile Developer", null],

        // Sin frase de rol: decide la tecnología
        ["React Engineer Semi Senior", "Frontend Developer", "SEMI_SENIOR"],
        ["Ninja React Engineer", "Frontend Developer", null],
        ["Angular Developer", "Frontend Developer", null],
        ["Java Developer", "Backend Developer", null],
        ["Desarrollador Java Senior", "Backend Developer", "SENIOR"],
        ["Python Developer Sr", "Backend Developer", "SENIOR"],
        ["Programador .NET", "Backend Developer", null],
        ["Node.js Developer", "Backend Developer", null],
        ["Java Senior", "Backend Developer", "SENIOR"],
        ["Android Developer", "Mobile Developer", null],
        ["Desarrollador React Native", "Mobile Developer", null],
        ["Flutter Developer Jr", "Mobile Developer", "JUNIOR"],

        // Frontend y backend juntos
        ["Frontend/Backend Developer", "Full Stack Developer", null],
        ["Desarrollador React y Node", "Full Stack Developer", null],

        // Genérico
        ["Software Engineer", "Software Developer", null],
        ["Desarrollador/a de Software Trainee", "Software Developer", "TRAINEE"],
        ["Analista Programador", "Software Developer", null],
        ["JavaScript Developer", "Software Developer", null],

        // La frase específica le gana a la genérica y a la tecnología
        ["Software Engineer Backend (Java)", "Backend Developer", null],
        ["QA Automation Engineer", "QA Automation", null],
        ["Analista QA Automation Sr", "QA Automation", "SENIOR"],
        ["Analista QA", "QA Analyst", null],
        ["Tester Manual Jr", "QA Analyst", "JUNIOR"],
        ["Data Engineer", "Data Engineer", null],
        ["Ingeniero de Datos Sr", "Data Engineer", "SENIOR"],
        ["Analista de Datos", "Data Analyst", null],
        ["Data Scientist Senior", "Data Scientist", "SENIOR"],
        ["Machine Learning Engineer", "AI/ML Engineer", null],
        ["Analista BI", "BI Analyst", null],
        ["Power BI Developer", "BI Analyst", null],
        ["DevOps Engineer", "DevOps Engineer", null],
        ["Cloud Architect", "Cloud Engineer", null],
        ["Arquitecto de Software", "Software Architect", null],
        ["Administrador de Bases de Datos", "Database Administrator", null],

        // Producto, gestión y diseño
        ["Project Manager IT", "Project Manager", null],
        ["Líder de Proyectos", "Project Manager", null],
        ["Scrum Master", "Scrum Master", null],
        ["Product Owner", "Product Owner", null],
        ["Analista Funcional Sr", "Functional Analyst", "SENIOR"],
        ["Diseñador UX/UI", "UX/UI Designer", null],
        ["UI Developer", "Frontend Developer", null],
        ["Soporte Técnico Nivel 1", "IT Support", null],

        // "Lead" como puesto y como seniority
        ["Tech Lead", "Tech Lead", null],
        ["Líder Técnico Backend", "Tech Lead", null],
        ["Lead Frontend Developer", "Frontend Developer", "LEAD"],
        ["Senior Tech Lead", "Tech Lead", "SENIOR"],
    ];

    it.each(cases)("%s", (title, role, seniority) => {
        expect(classify(title)).toEqual([role, seniority]);
    });

    it("deja sin clasificar lo que no es un rol del diccionario", () => {
        for (const title of ["Vendedor", "Administrativo Contable", "Oferta Laboral", "Chofer con registro", ""]) {
            expect(classify(title), title).toEqual([null, null]);
        }
    });

    it("detecta el seniority aunque no reconozca el rol", () => {
        expect(classify("Vendedor Senior")).toEqual([null, "SENIOR"]);
    });

    it("arma un núcleo sin seniority ni relleno, para agrupar títulos parecidos", () => {
        const core = (title: string) => classifyTitle(title, dictionary).core;
        expect(core("Vendedor de Software Sr - Remoto")).toBe("vendedor software");
        expect(core("Vendedor de software (Semi Senior)")).toBe("vendedor software");
        expect(core("Senior Growth Hacker LATAM")).toBe("growth hacker");
    });
});
