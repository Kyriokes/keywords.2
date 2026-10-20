import { describe, expect, it } from "vitest";
import { emptySourceStats } from "@/lib/ingest/stats";
import {
    buildFunnel, rankCompanies, rankRoles, rankSources, reasonCategory, summarizeAnswers, summarizeReasons, type ApplicationRow, type OfferRow,
} from "./searchStats";

const offer = (fields: Partial<OfferRow> = {}): OfferRow => ({
    source: "remotive", board: null, company: "Acme", roleName: "Full Stack Developer", decision: "QUEUED", reason: null, score: 60, ...fields,
});
const application = (fields: Partial<ApplicationRow> = {}): ApplicationRow => ({ source: "remotive", status: "APPLIED", company: null, ...fields });

describe("reasonCategory", () => {
    it("agrupa los motivos que llevan números o lugares", () => {
        expect(reasonCategory("Pide 7 años de experiencia")).toBe("Pide más años de los que aceptás");
        expect(reasonCategory("Senior: pide 6 años")).toBe("Senior con más años de los que aceptás");
        expect(reasonCategory("Match 32% (mínimo 40%)")).toBe("Match bajo con el CV");
        expect(reasonCategory("Solo para USA, Canada")).toBe("Solo para otro país");
        expect(reasonCategory("Exige vivir en United States")).toBe("Exige vivir en otro país");
        expect(reasonCategory("Pide permiso de trabajo en the EU")).toBe("Pide permiso de trabajo de otro país");
        expect(reasonCategory("Pide mudanza sin sueldo publicado")).toBe("Pide mudanza");
        expect(reasonCategory("El título pide Go, Kubernetes")).toBe("El título pide un stack que no tenés");
    });

    it("deja igual los motivos que ya son una categoría", () => {
        for (const reason of ["Puesto de liderazgo", "Sin sueldo", "Híbrido fuera de Buenos Aires", "Presencial", "Pide ciudadanía o clearance", "Sin keywords para comparar con el CV"]) {
            expect(reasonCategory(reason)).toBe(reason);
        }
    });
});

describe("summarizeReasons", () => {
    it("separa los motivos combinados y cuenta de mayor a menor", () => {
        expect(summarizeReasons(["Solo para USA · Presencial", "Solo para Canada", null, "Pide 3 años de experiencia"])).toEqual([
            { label: "Solo para otro país", count: 2 },
            { label: "Pide más años de los que aceptás", count: 1 },
            { label: "Presencial", count: 1 },
        ]);
    });
});

describe("rankSources", () => {
    it("ordena los portales por ofertas de tus puestos y cruza con lo enviado", () => {
        const offers = [
            offer(), offer({ decision: "REJECTED", reason: "Presencial" }), offer({ decision: "OTHER_ROLE", roleName: "Marketing" }),
            offer({ source: "greenhouse", board: "stripe" }), offer({ source: "greenhouse", board: "stripe", decision: "PASSES" }), offer({ source: "greenhouse", board: "clara" }),
        ];
        const applications = [
            application({ source: "greenhouse", status: "INTERVIEW" }), application({ source: "greenhouse" }), application({ source: "manual" }),
        ];
        const lastRun = { remotive: { ...emptySourceStats(), error: "503 Service Unavailable (https://remotive.com/api/remote-jobs?limit=200)" } };

        const ranks = rankSources(offers, applications, lastRun);

        expect(ranks.map((rank) => rank.source)).toEqual(["greenhouse", "remotive", "manual"]);
        expect(ranks[0]).toEqual({ source: "greenhouse", label: "Greenhouse", offers: 3, ofMyRoles: 3, passed: 3, queued: 2, rejected: 0, applied: 2, interviews: 1, yield: 100, lastError: null });
        expect(ranks[1]).toMatchObject({ offers: 3, ofMyRoles: 2, passed: 1, queued: 1, rejected: 1, applied: 0, yield: 50 });
        expect(ranks[2]).toMatchObject({ label: "Cargadas a mano", offers: 0, ofMyRoles: 0, yield: null, applied: 1 });
    });

    it("muestra el error de la última búsqueda por portal, uniendo los boards", () => {
        const lastRun = {
            remotive: { ...emptySourceStats(), error: "503 Service Unavailable (https://remotive.com/api)" },
            "greenhouse:stripe": { ...emptySourceStats(), error: "404 Not Found (https://boards-api.greenhouse.io/v1/boards/stripe/jobs)" },
            "greenhouse:clara": { ...emptySourceStats(), fetched: 3 },
        };
        const ranks = rankSources([offer(), offer({ source: "greenhouse", board: "clara" })], [], lastRun);

        expect(ranks.find((rank) => rank.source === "remotive")?.lastError).toBe("503 Service Unavailable");
        expect(ranks.find((rank) => rank.source === "greenhouse")?.lastError).toBe("stripe: 404 Not Found");
    });
});

describe("buildFunnel", () => {
    it("cuenta cada etapa del embudo", () => {
        const offers = [offer(), offer({ decision: "PASSES" }), offer({ decision: "REJECTED" }), offer({ decision: "OTHER_ROLE" }), offer({ decision: "IN_ACCOUNT" })];
        const applications = ["APPROVED", "APPLIED", "INTERVIEW", "REJECTED", "READY", "SKIPPED"].map((status) => application({ status }));

        expect(buildFunnel(offers, applications)).toEqual({ offers: 5, ofMyRoles: 3, passedFilters: 2, queued: 1, approved: 4, applied: 3, interviews: 1 });
    });
});

describe("rankCompanies", () => {
    it("lista las empresas que más publican de tus puestos, con el board para seguirlas", () => {
        const offers = [
            offer({ company: "Clara", source: "greenhouse", board: "clara" }), offer({ company: "Clara", source: "greenhouse", board: "clara", decision: "REJECTED" }),
            offer({ company: "Acme" }), offer({ company: "Zeta", decision: "OTHER_ROLE" }), offer({ company: null }),
        ];
        expect(rankCompanies(offers)).toEqual([
            { company: "Clara", offers: 2, passed: 1, board: "greenhouse:clara" },
            { company: "Acme", offers: 1, passed: 1, board: null },
        ]);
    });
});

describe("rankRoles", () => {
    it("muestra qué roles publican los portales y cuáles seguís", () => {
        const offers = [offer(), offer({ decision: "OTHER_ROLE", roleName: "Data Engineer" }), offer({ decision: "OTHER_ROLE", roleName: "Data Engineer" }), offer({ decision: "OTHER_ROLE", roleName: null })];
        expect(rankRoles(offers)).toEqual([
            { role: "Data Engineer", offers: 2, desired: false },
            { role: "Full Stack Developer", offers: 1, desired: true },
            { role: "Sin clasificar", offers: 1, desired: false },
        ]);
    });
});

describe("summarizeAnswers", () => {
    it("resume de dónde salieron las respuestas y qué preguntas se repiten sin plantilla", () => {
        const templates = [{ id: "t1", question: "Pretensión salarial" }, { id: "t2", question: "Nivel de inglés" }];
        const answers = [
            { question: "Salary expectations", templateId: "t1", origin: "TEMPLATE" },
            { question: "Expected salary?", templateId: "t1", origin: "ADAPTED" },
            { question: "¿Por qué querés trabajar acá?", templateId: null, origin: "AGENT" },
            { question: "Por qué querés  trabajar acá", templateId: null, origin: "AGENT" },
            { question: "GitHub", templateId: null, origin: null },
        ];
        expect(summarizeAnswers(answers, templates)).toEqual({
            total: 5,
            byOrigin: { TEMPLATE: 1, ADAPTED: 1, AGENT: 2, SIN_DATO: 1 },
            templates: [{ templateId: "t1", question: "Pretensión salarial", used: 2 }, { templateId: "t2", question: "Nivel de inglés", used: 0 }],
            repeatedWithoutTemplate: [{ question: "Por qué querés trabajar acá", count: 2 }],
        });
    });
});
