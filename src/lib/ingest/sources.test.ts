import { describe, expect, it, vi } from "vitest";
import {
    fetchGetOnBoard,
    htmlToText,
    monthlyUsd,
    parseAshby,
    parseAtsBoard,
    parseGetOnBoard,
    parseGreenhouse,
    parseHimalayas,
    parseJobicy,
    parseLever,
    parseRemoteOk,
    parseRemotive,
    parseSmartRecruitersPosting,
    parseWorkable,
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

    it("una entidad numérica fuera de rango no rompe la lectura del aviso", () => {
        // String.fromCodePoint tira RangeError con estos valores: antes se caía el portal entero
        expect(htmlToText("<p>Hola &#99999999; y &#x110000; chau</p>")).toBe("Hola &#99999999; y &#x110000; chau");
    });

    it("no deja caracteres nulos, que la base no puede guardar", () => {
        expect(htmlToText("<p>React&#0; y Node\u0000</p>")).toBe("React y Node");
    });
});

describe("links de postulación", () => {
    it("un formulario que no es http(s) se descarta y la oferta queda con su publicación", () => {
        const [job] = parseRemoteOk([
            { legal: "API terms" },
            { id: "9", position: "Backend", company: "Beta", url: "https://remoteok.com/9", apply_url: "javascript:alert(1)", description: "<b>Go</b>" },
        ]);
        expect(job).toMatchObject({ externalId: "9", applyUrl: null });
    });

    it("un formulario relativo o con espacios no se guarda", () => {
        const jobs = parseLever(
            [
                { id: "a", text: "Dev", hostedUrl: "https://jobs.lever.co/acme/a", applyUrl: "/acme/a/apply", descriptionPlain: "React" },
                { id: "b", text: "Dev", hostedUrl: "https://jobs.lever.co/acme/b", applyUrl: "https://jobs.lever.co/acme/b/apply", descriptionPlain: "React" },
            ],
            "acme"
        );
        expect(jobs.map((job) => job.applyUrl)).toEqual([null, "https://jobs.lever.co/acme/b/apply"]);
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

    it("Get on Board: toma el nivel que publica el portal (Expert cuenta como Senior)", () => {
        const level = (name: string) => ({ data: { id: "1", type: "seniority", attributes: { name } } });
        const offer = (id: string, seniority?: unknown) => ({
            id,
            attributes: { title: "Dev", description: "<p>React</p>", seniority },
            links: { public_url: `https://www.getonbrd.com/jobs/${id}` },
        });
        const jobs = parseGetOnBoard({
            data: [
                offer("senior", level("Senior")),
                offer("ssr", level("Semi Senior")),
                offer("junior", level("Junior")),
                offer("sin-experiencia", level("No experience")),
                offer("expert", level("Expert")),
                offer("sin-expandir", { data: { id: "4", type: "seniority" } }),
                offer("sin-nivel"),
            ],
        });
        expect(jobs.map((job) => job.seniorityHint ?? null)).toEqual(["SENIOR", "SEMI_SENIOR", "JUNIOR", "TRAINEE", "SENIOR", null, null]);
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

describe("fetchGetOnBoard", () => {
    const offer = (id: string) => ({
        id,
        attributes: { title: "Desarrollador/a Full-Stack", description: "<p>React</p>" },
        links: { public_url: `https://www.getonbrd.com/jobs/${id}` },
    });
    // Una respuesta por pedido: cada página de una categoría trae una oferta con su número
    const portal = (programmingPages: number) =>
        vi.fn(async (url: string) => {
            const { pathname, searchParams } = new URL(url);
            const page = searchParams.get("page") ?? "1";
            if (pathname.endsWith("/search/jobs")) {
                return { data: [offer(`busqueda-${searchParams.get("query")?.toLowerCase().replaceAll(" ", "-")}`)], meta: { total_pages: 1 } };
            }
            if (pathname.includes("/categories/programming/")) return { data: [offer(`programming-${page}`)], meta: { total_pages: programmingPages } };
            if (pathname.includes("/categories/machine-learning-ai/")) return { data: [offer(`ia-${page}`)], meta: { total_pages: 1 } };
            throw new Error(`pedido inesperado: ${url}`);
        });
    const pagesOf = (get: ReturnType<typeof portal>, category: string) =>
        get.mock.calls.map(([url]) => new URL(url)).filter((url) => url.pathname.includes(`/categories/${category}/`)).map((url) => url.searchParams.get("page"));

    it("además de buscar cada puesto, lee enteras las categorías de programación y de IA", async () => {
        const get = portal(2);

        const jobs = await fetchGetOnBoard(["Full Stack Developer"], get);

        expect(jobs.map((job) => job.externalId).sort()).toEqual(["busqueda-full-stack-developer", "ia-1", "programming-1", "programming-2"]);
        expect(pagesOf(get, "programming")).toEqual(["1", "2"]);
    });

    it("no lee más de 6 páginas por categoría aunque el portal diga que hay más", async () => {
        const get = portal(50);

        await fetchGetOnBoard(["Full Stack Developer"], get);

        expect(pagesOf(get, "programming")).toEqual(["1", "2", "3", "4", "5", "6"]);
    });
});

describe("sueldo publicado", () => {
    it("monthlyUsd pasa el sueldo a USD por mes y descarta otras monedas", () => {
        expect(monthlyUsd(120000, 150000, "USD", "annual")).toBe(10000);
        expect(monthlyUsd(null, 3000, "usd", "monthly")).toBe(3000);
        expect(monthlyUsd(25, undefined, "USD", "hourly")).toBe(4000);
        expect(monthlyUsd(450900, null, "MXN", "yearly")).toBeUndefined();
        expect(monthlyUsd(5000, null, null, "monthly")).toBeUndefined();
        expect(monthlyUsd(0, null, "USD", "monthly")).toBeUndefined();
        expect(monthlyUsd(5000, null, "USD", "por proyecto")).toBeUndefined();
    });

    it("cada portal informa el sueldo con sus propios campos", () => {
        const html = "<p>React</p>";
        expect(
            parseHimalayas({ jobs: [{ guid: "h", title: "Dev", applicationLink: "https://himalayas.app/j/h", description: html, minSalary: 2500, maxSalary: 7000, currency: "USD", salaryPeriod: "monthly" }] })[0]
                .salaryUsdMonthly
        ).toBe(2500);
        expect(
            parseGetOnBoard({ data: [{ id: "g", attributes: { title: "Dev", description: html, min_salary: 2300, max_salary: 3300 }, links: { public_url: "https://www.getonbrd.com/jobs/g" } }] })[0]
                .salaryUsdMonthly
        ).toBe(2300);
        expect(
            parseRemoteOk([{ legal: "x" }, { id: 1, position: "Dev", url: "https://remoteok.com/1", description: html, salary_min: 120000, salary_max: 160000 }])[0].salaryUsdMonthly
        ).toBe(10000);
        expect(
            parseJobicy({ jobs: [{ id: 2, url: "https://jobicy.com/jobs/2", jobTitle: "Dev", jobDescription: html, salaryMin: 96000, salaryCurrency: "USD", salaryPeriod: "yearly" }] })[0]
                .salaryUsdMonthly
        ).toBe(8000);
        expect(
            parseLever(
                [{ id: "l", text: "Dev", hostedUrl: "https://jobs.lever.co/acme/l", descriptionPlain: "React", salaryRange: { min: 4000, max: 5000, currency: "USD", interval: "per-month-salary" } }],
                "acme"
            )[0].salaryUsdMonthly
        ).toBe(4000);
    });
});

describe("Workable y SmartRecruiters", () => {
    it("Workable: ofertas de la cuenta con sus países y si son remotas", () => {
        const jobs = parseWorkable(
            {
                name: "Workstate",
                jobs: [
                    {
                        shortcode: "B289E00FD2",
                        title: "Senior Full Stack Developer - LATAM Remote",
                        url: "https://apply.workable.com/j/B289E00FD2",
                        application_url: "https://apply.workable.com/j/B289E00FD2/apply",
                        telecommuting: true,
                        locations: [{ country: "Colombia" }, { country: "Argentina" }],
                        description: "<p>React y Node</p>",
                    },
                    { shortcode: "X1", title: "Contador", url: "https://apply.workable.com/j/X1", telecommuting: false, country: "Mexico", city: "CDMX", description: "<p>x</p>" },
                    { shortcode: "X2", title: "Sin descripción", url: "https://apply.workable.com/j/X2" },
                ],
            },
            "workstate"
        );
        expect(jobs).toEqual([
            {
                source: "workable",
                externalId: "workstate:B289E00FD2",
                title: "Senior Full Stack Developer - LATAM Remote",
                company: "Workstate",
                url: "https://apply.workable.com/j/B289E00FD2",
                applyUrl: "https://apply.workable.com/j/B289E00FD2/apply",
                description: "React y Node",
                location: "Remoto desde Colombia, Argentina",
            },
            expect.objectContaining({ externalId: "workstate:X1", location: "CDMX, Mexico" }),
        ]);
    });

    it("SmartRecruiters: arma la oferta con el detalle de la publicación", () => {
        const detail = (location: Record<string, unknown>) => ({
            id: "744000154726210",
            name: "Full Stack Developer",
            company: { name: "Endava", identifier: "Endava" },
            location: { city: "Buenos Aires", country: "ar", fullLocation: "Buenos Aires, Argentina", ...location },
            postingUrl: "https://jobs.smartrecruiters.com/Endava/744000154726210-full-stack-developer",
            applyUrl: "https://jobs.smartrecruiters.com/Endava/744000154726210-full-stack-developer?oga=true",
            jobAd: { sections: { jobDescription: { text: "<p>React</p>" }, qualifications: { text: "<p>Node</p>" } } },
        });

        expect(parseSmartRecruitersPosting(detail({ remote: true }), "endava")).toEqual({
            source: "smartrecruiters",
            externalId: "endava:744000154726210",
            title: "Full Stack Developer",
            company: "Endava",
            url: "https://jobs.smartrecruiters.com/Endava/744000154726210-full-stack-developer",
            applyUrl: "https://jobs.smartrecruiters.com/Endava/744000154726210-full-stack-developer?oga=true",
            description: "React\n\nNode",
            location: "Remoto desde Buenos Aires, Argentina",
        });
        expect(parseSmartRecruitersPosting(detail({ hybrid: true }), "endava")?.location).toBe("Híbrido · Buenos Aires, Argentina");
        expect(parseSmartRecruitersPosting(detail({}), "endava")?.location).toBe("Presencial · Buenos Aires, Argentina");
        expect(parseSmartRecruitersPosting({ id: "1", name: "Sin texto" }, "endava")).toBeNull();
    });
});

describe("parseAtsBoard", () => {
    it("acepta Workable y SmartRecruiters", () => {
        expect(parseAtsBoard("workable:workstate")).toEqual({ source: "workable", board: "workstate" });
        expect(parseAtsBoard("SmartRecruiters:Endava")).toEqual({ source: "smartrecruiters", board: "endava" });
    });

    it("acepta source:empresa y rechaza el resto", () => {
        expect(parseAtsBoard(" Greenhouse:Stripe ")).toEqual({ source: "greenhouse", board: "stripe" });
        expect(parseAtsBoard("lever:netflix")).toEqual({ source: "lever", board: "netflix" });
        expect(parseAtsBoard("workday:acme")).toBeNull();
        expect(parseAtsBoard("greenhouse:../admin")).toBeNull();
        expect(parseAtsBoard("stripe")).toBeNull();
    });
});
