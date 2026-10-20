import { describe, expect, it } from "vitest";
import { atsBoardFromUrl, suggestAtsBoards } from "./boards";

describe("atsBoardFromUrl", () => {
    it("reconoce la página de empleos de cada ATS", () => {
        expect(atsBoardFromUrl("https://job-boards.greenhouse.io/coderoad/jobs/4121005009")).toBe("greenhouse:coderoad");
        expect(atsBoardFromUrl("https://boards.greenhouse.io/Stripe/jobs/123?gh_jid=123")).toBe("greenhouse:stripe");
        expect(atsBoardFromUrl("https://jobs.lever.co/webfx/5c718597-3d8a-4986-9083-de761edfa4d4/apply")).toBe("lever:webfx");
        expect(atsBoardFromUrl("https://jobs.ashbyhq.com/supabase/abc-123")).toBe("ashby:supabase");
        expect(atsBoardFromUrl("https://apply.workable.com/workstate/jobs/view/B289E00FD2")).toBe("workable:workstate");
        expect(atsBoardFromUrl("https://jobs.smartrecruiters.com/Endava/744000154726210-dev")).toBe("smartrecruiters:endava");
    });

    it("ignora los links que no dicen de qué empresa son", () => {
        // Los links cortos de Workable no traen la cuenta
        expect(atsBoardFromUrl("https://apply.workable.com/j/B289E00FD2/apply")).toBeNull();
        expect(atsBoardFromUrl("https://boards.greenhouse.io/embed/job_app?for=acme&token=1")).toBeNull();
    });

    it("ignora otros portales y links inválidos", () => {
        expect(atsBoardFromUrl("https://www.linkedin.com/jobs/view/1/")).toBeNull();
        expect(atsBoardFromUrl("https://himalayas.app/companies/acme/jobs/dev")).toBeNull();
        expect(atsBoardFromUrl("no es un link")).toBeNull();
    });
});

describe("suggestAtsBoards", () => {
    it("cuenta las ofertas por empresa y deja afuera las que ya se siguen", () => {
        const links = [
            "https://jobs.lever.co/webfx/1",
            "https://jobs.lever.co/webfx/2/apply",
            "https://jobs.ashbyhq.com/supabase/3",
            "https://job-boards.greenhouse.io/coderoad/jobs/4",
            "https://www.linkedin.com/jobs/view/5/",
            null,
        ];

        expect(suggestAtsBoards(links, ["ashby:supabase"])).toEqual([
            { board: "lever:webfx", offers: 2 },
            { board: "greenhouse:coderoad", offers: 1 },
        ]);
    });

    it("cuenta una sola vez la oferta que trae el mismo board en el link y en el formulario", () => {
        expect(suggestAtsBoards([["https://jobs.lever.co/webfx/1", "https://jobs.lever.co/webfx/1/apply"]], [])).toEqual([
            { board: "lever:webfx", offers: 1 },
        ]);
    });
});
