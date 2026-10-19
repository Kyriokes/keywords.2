import { describe, expect, it } from "vitest";
import {
    htmlToText,
    parseAshby,
    parseAtsBoard,
    parseGetOnBoard,
    parseGreenhouse,
    parseHimalayas,
    parseJobicy,
    parseLever,
    parseRemoteOk,
    parseRemotive,
} from "./sources";

describe("htmlToText", () => {
    it("convierte párrafos y viñetas, y decodifica entidades", () => {
        expect(htmlToText("<p>Buscamos &amp; ofrecemos</p><ul><li>React</li><li>Node</li></ul>")).toBe(
            "Buscamos & ofrecemos\n\n• React\n• Node"
        );
    });

    it("entiende el HTML escapado de Greenhouse", () => {
        expect(htmlToText("&lt;p&gt;Hola &amp;amp; chau&lt;/p&gt;")).toBe("Hola & chau");
    });

    it("descarta scripts y estilos", () => {
        expect(htmlToText("<style>p{}</style><p>Texto</p><script>alert(1)</script>")).toBe("Texto");
    });
});

describe("parsers", () => {
    it("Remotive", () => {
        const jobs = parseRemotive({
            jobs: [
                { id: 1, url: "https://remotive.com/1", title: "React Dev", company_name: "Acme", description: "<p>React</p>", candidate_required_location: "Worldwide" },
                { id: 2, url: "https://remotive.com/2", title: "", description: "<p>x</p>" },
            ],
        });
        expect(jobs).toEqual([
            { source: "remotive", externalId: "1", title: "React Dev", company: "Acme", url: "https://remotive.com/1", applyUrl: null, description: "React", location: "Worldwide" },
        ]);
    });

    it("Remote OK ignora el aviso legal del primer elemento", () => {
        const jobs = parseRemoteOk([
            { legal: "API terms" },
            { id: "9", position: "Backend", company: "Beta", url: "https://remoteok.com/9", apply_url: "https://beta.com/apply", description: "<b>Go</b>" },
        ]);
        expect(jobs).toHaveLength(1);
        expect(jobs[0]).toMatchObject({ externalId: "9", applyUrl: "https://beta.com/apply", description: "Go" });
    });

    it("Himalayas", () => {
        const jobs = parseHimalayas({
            jobs: [{ guid: "g1", title: "QA", companyName: "Gamma", applicationLink: "https://himalayas.app/j/1", description: "<p>QA</p>", locationRestrictions: ["Argentina", "Chile"] }],
        });
        expect(jobs[0]).toMatchObject({ externalId: "g1", company: "Gamma", location: "Argentina, Chile" });
    });

    it("Himalayas: resume las listas largas de países y marca worldwide las que no restringen", () => {
        const countries = ["Albania", "Argentina", "Brazil", "Chile", "Spain"];
        const jobs = parseHimalayas({
            jobs: [
                { guid: "g2", title: "Dev", applicationLink: "https://himalayas.app/j/2", description: "x", locationRestrictions: countries },
                { guid: "g3", title: "Dev", applicationLink: "https://himalayas.app/j/3", description: "x", locationRestrictions: [] },
                { guid: "g4", title: "Dev", applicationLink: "https://himalayas.app/j/4", description: "x", locationRestrictions: ["United States", "Canada", "Mexico", "Spain"] },
            ],
        });
        expect(jobs.map((job) => job.location)).toEqual([
            "Argentina y 4 países más",
            "Worldwide",
            "United States, Canada, Mexico, Spain",
        ]);
    });

    it("Jobicy", () => {
        const jobs = parseJobicy({
            jobs: [
                {
                    id: 155937,
                    url: "https://jobicy.com/jobs/155937-dev",
                    jobTitle: "Full-Stack Engineer",
                    companyName: "Elevenlabs",
                    jobGeo: "LATAM",
                    jobDescription: "<h3>About</h3><p>React &amp; Node</p>",
                },
                { id: 2, url: "https://jobicy.com/jobs/2", jobTitle: "", jobDescription: "<p>x</p>" },
            ],
        });
        expect(jobs).toEqual([
            {
                source: "jobicy",
                externalId: "155937",
                title: "Full-Stack Engineer",
                company: "Elevenlabs",
                url: "https://jobicy.com/jobs/155937-dev",
                applyUrl: null,
                description: "About\nReact & Node",
                location: "LATAM",
            },
        ]);
    });

    it("Get on Board", () => {
        const jobs = parseGetOnBoard({
            data: [
                {
                    id: "dev-123",
                    attributes: { title: "Dev", description: "<p>Hacer cosas</p>", functions: "<p>Más</p>", remote: true, company: { data: { attributes: { name: "Delta" } } } },
                    links: { public_url: "https://www.getonbrd.com/jobs/dev-123" },
                },
            ],
        });
        expect(jobs[0]).toMatchObject({ externalId: "dev-123", company: "Delta", location: "Remoto", description: "Hacer cosas\n\nMás" });
    });

    it("Get on Board: arma la ubicación con la modalidad, la ciudad y los países permitidos", () => {
        const names = (items: string[], type: string) => ({ data: items.map((name) => ({ id: name, type, attributes: { name } })) });
        const offer = (id: string, attributes: Record<string, unknown>) => ({
            id,
            attributes: { title: "Dev", description: "<p>React</p>", ...attributes },
            links: { public_url: `https://www.getonbrd.com/jobs/${id}` },
        });
        const jobs = parseGetOnBoard({
            data: [
                offer("remoto", { remote_modality: "fully_remote", countries: ["Remote"] }),
                offer("remoto-local", {
                    remote_modality: "remote_local",
                    countries: ["Remote"],
                    location_regions: names(["South America"], "region"),
                    location_tenants: names(["Mexico"], "country"),
                }),
                offer("hibrido", {
                    remote_modality: "hybrid",
                    countries: ["Chile"],
                    location_cities: { data: [{ id: "1", type: "tenant_city", attributes: { name: "Santiago", country: "Chile" } }] },
                }),
                offer("presencial", { remote_modality: "no_remote", countries: ["Argentina"] }),
            ],
        });
        expect(jobs.map((job) => job.location)).toEqual([
            "Remoto",
            "Remoto desde South America, Mexico",
            "Híbrido · Santiago, Chile",
            "Presencial · Argentina",
        ]);
    });

    it("Greenhouse, Lever y Ashby prefijan el id con la empresa", () => {
        const greenhouse = parseGreenhouse(
            { jobs: [{ id: 5, title: "SRE", absolute_url: "https://boards.greenhouse.io/acme/jobs/5", content: "&lt;p&gt;SRE&lt;/p&gt;", location: { name: "Remote" } }] },
            "acme"
        );
        expect(greenhouse[0]).toMatchObject({ externalId: "acme:5", company: "acme", description: "SRE", location: "Remote" });

        const lever = parseLever(
            [{ id: "ab", text: "PM", hostedUrl: "https://jobs.lever.co/beta/ab", applyUrl: "https://jobs.lever.co/beta/ab/apply", descriptionPlain: "Producto", lists: [{ text: "Requisitos", content: "<li>SQL</li>" }] }],
            "beta"
        );
        expect(lever[0]).toMatchObject({ externalId: "beta:ab", applyUrl: "https://jobs.lever.co/beta/ab/apply" });
        expect(lever[0].description).toContain("Requisitos\n• SQL");

        const ashby = parseAshby({ jobs: [{ id: "x1", title: "Eng", jobUrl: "https://jobs.ashbyhq.com/c/x1", descriptionPlain: "Código" }] }, "c");
        expect(ashby[0]).toMatchObject({ externalId: "c:x1", description: "Código" });
    });

    it("toleran respuestas inesperadas sin romperse", () => {
        for (const value of [null, {}, [], "error", { jobs: "no" }]) {
            expect(parseRemotive(value)).toEqual([]);
            expect(parseRemoteOk(value)).toEqual([]);
            expect(parseGreenhouse(value, "x")).toEqual([]);
            expect(parseLever(value, "x")).toEqual([]);
        }
    });
});

describe("parseAtsBoard", () => {
    it("acepta source:empresa y rechaza el resto", () => {
        expect(parseAtsBoard(" Greenhouse:Stripe ")).toEqual({ source: "greenhouse", board: "stripe" });
        expect(parseAtsBoard("lever:netflix")).toEqual({ source: "lever", board: "netflix" });
        expect(parseAtsBoard("workday:acme")).toBeNull();
        expect(parseAtsBoard("greenhouse:../admin")).toBeNull();
        expect(parseAtsBoard("stripe")).toBeNull();
    });
});
