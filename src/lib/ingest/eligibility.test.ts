import { describe, expect, it } from "vitest";
import { checkEligibility, detectWorkMode, extractYearsRequired, type EligibilityRules, type OfferForEligibility } from "./eligibility";

const rules: EligibilityRules = {
    workModes: ["REMOTE", "REMOTE_US_HOURS", "HYBRID"],
    seniorityPolicy: "FLEXIBLE",
    minScore: 40,
};

function offer(fields: Partial<OfferForEligibility>): OfferForEligibility {
    return { source: "greenhouse", title: "Full Stack Developer", location: null, description: "React, Node.js y TypeScript.", seniority: null, ...fields };
}

describe("extractYearsRequired", () => {
    it("lee los años pedidos en inglés", () => {
        expect(extractYearsRequired("You have 3+ years of experience with React.")).toBe(3);
        expect(extractYearsRequired("Minimum of 4 years professional experience in software development")).toBe(4);
    });

    it("toma el piso de un rango", () => {
        expect(extractYearsRequired("3-5 years of experience building web apps")).toBe(3);
    });

    it("lee los años pedidos en español", () => {
        expect(extractYearsRequired("Contar con al menos 2 años de experiencia como desarrollador.")).toBe(2);
        expect(extractYearsRequired("Experiencia mínima de 5 años en Node.js")).toBe(5);
    });

    it("se queda con el mayor de los requisitos", () => {
        expect(extractYearsRequired("2+ years with AWS. 5+ years of experience in web development.")).toBe(5);
    });

    it("ignora los años que no hablan de experiencia", () => {
        expect(extractYearsRequired("We have been building products for 10 years. React experience is a plus.")).toBeNull();
        expect(extractYearsRequired("With 25 years of experience in the market, our company...")).toBeNull();
    });
});

describe("detectWorkMode", () => {
    it("los portales de remoto son remotos salvo que digan otra cosa", () => {
        expect(detectWorkMode(offer({ source: "remotive", location: "Worldwide" }))).toBe("REMOTE");
    });

    it("reconoce híbrido y presencial en el título o la ubicación", () => {
        expect(detectWorkMode(offer({ title: "Desarrollador Full Stack - Híbrido" }))).toBe("HYBRID");
        expect(detectWorkMode(offer({ location: "Buenos Aires (On-site)" }))).toBe("ONSITE");
    });

    it("detecta cuando el remoto pide horario de EE.UU.", () => {
        const description = "Fully remote. You must overlap with EST business hours.";
        expect(detectWorkMode(offer({ source: "remoteok", description }))).toBe("REMOTE_US_HOURS");
    });

    it("devuelve null si no hay pistas", () => {
        expect(detectWorkMode(offer({}))).toBeNull();
    });
});

describe("checkEligibility", () => {
    it("acepta un remoto para LatAm sin bloqueos", () => {
        const result = checkEligibility(offer({ source: "remotive", location: "LATAM" }), rules);
        expect(result.blockers).toEqual([]);
        expect(result.minScore).toBe(40);
        expect(result.summary).toBe("Remoto");
    });

    it("descarta ubicaciones fuera de la región", () => {
        expect(checkEligibility(offer({ source: "remotive", location: "USA, Canada" }), rules).blockers).toEqual([
            "Solo para USA, Canada",
        ]);
        expect(checkEligibility(offer({ location: "Remote - US" }), rules).blockers).toEqual(["Solo para Remote - US"]);
    });

    it("acepta Americas, worldwide y Argentina en la ubicación", () => {
        for (const location of ["Americas", "Worldwide", "Argentina, Brazil", "Remote", "Latin America"]) {
            expect(checkEligibility(offer({ source: "remotive", location }), rules).blockers, location).toEqual([]);
        }
    });

    it("descarta las que piden ciudadanía o clearance", () => {
        const description = "Applicants must be US citizens and able to obtain a security clearance.";
        expect(checkEligibility(offer({ description }), rules).blockers).toContain("Pide ciudadanía o clearance");
    });

    it("descarta las que exigen vivir en otro país", () => {
        const description = "Remote role. Candidates must be located in the United States.";
        expect(checkEligibility(offer({ source: "remoteok", description }), rules).blockers).toEqual([
            "Exige vivir en United States",
        ]);
    });

    it("acepta las que exigen vivir en la región", () => {
        const description = "Remote role. You must be based in Latin America.";
        expect(checkEligibility(offer({ source: "remoteok", description }), rules).blockers).toEqual([]);
    });

    it("descarta las que piden permiso de trabajo de otro país", () => {
        const description = "You must be authorized to work in the UK.";
        expect(checkEligibility(offer({ source: "remotive", description }), rules).blockers).toEqual([
            "Pide permiso de trabajo en UK",
        ]);
    });

    it("descarta las que piden mudarse", () => {
        const description = "Hybrid position in Madrid. Willingness to relocate is required.";
        expect(checkEligibility(offer({ description }), rules).blockers).toContain("Pide mudanza");
    });

    it("acepta híbrido en Buenos Aires y descarta híbrido en otra ciudad", () => {
        expect(checkEligibility(offer({ title: "Backend Developer (Híbrido)", location: "Palermo, CABA" }), rules).blockers).toEqual([]);
        expect(checkEligibility(offer({ title: "Backend Developer (Híbrido)", location: "Córdoba, Argentina" }), rules).blockers).toEqual([
            "Híbrido fuera de Buenos Aires",
        ]);
    });

    it("descarta presencial cuando no está entre las modalidades aceptadas", () => {
        expect(checkEligibility(offer({ title: "Desarrollador Presencial", location: "CABA" }), rules).blockers).toEqual(["Presencial"]);
    });

    it("descarta los puestos de liderazgo", () => {
        expect(checkEligibility(offer({ title: "Tech Lead Full Stack" }), rules).blockers).toEqual(["Puesto de liderazgo"]);
        expect(checkEligibility(offer({ title: "Engineering Manager" }), rules).blockers).toEqual(["Puesto de liderazgo"]);
        expect(checkEligibility(offer({ title: "Staff Engineer", seniority: "LEAD" }), rules).blockers).toEqual(["Puesto de liderazgo"]);
    });

    it("acepta Senior si piden hasta 5 años, pero le exige más score", () => {
        const result = checkEligibility(
            offer({ title: "Senior Full Stack Developer", seniority: "SENIOR", description: "4+ years of experience with React." }),
            rules
        );
        expect(result.blockers).toEqual([]);
        expect(result.minScore).toBe(60);
        expect(result.summary).toBe("Senior · pide 4 años");
    });

    it("descarta Senior que pide más de 5 años", () => {
        const result = checkEligibility(
            offer({ title: "Senior Backend Developer", seniority: "SENIOR", description: "8+ years of experience in backend." }),
            rules
        );
        expect(result.blockers).toEqual(["Senior: pide 8 años"]);
    });

    it("descarta cualquier puesto que pida más de 5 años", () => {
        const result = checkEligibility(offer({ description: "7 years of experience developing web apps." }), rules);
        expect(result.blockers).toEqual(["Pide 7 años de experiencia"]);
    });

    it("con la política solo Jr/SSr descarta Senior y más de 3 años", () => {
        const juniorOnly: EligibilityRules = { ...rules, seniorityPolicy: "JUNIOR_ONLY" };
        expect(checkEligibility(offer({ title: "Senior Developer", seniority: "SENIOR" }), juniorOnly).blockers).toEqual(["Senior"]);
        expect(checkEligibility(offer({ description: "4 years of experience with Node." }), juniorOnly).blockers).toEqual([
            "Pide 4 años de experiencia",
        ]);
    });

    it("con la política todo menos Lead acepta cualquier Senior", () => {
        const any: EligibilityRules = { ...rules, seniorityPolicy: "ANY" };
        const result = checkEligibility(
            offer({ title: "Senior Developer", seniority: "SENIOR", description: "10 years of experience." }),
            any
        );
        expect(result.blockers).toEqual([]);
        expect(result.minScore).toBe(40);
    });

    it("descarta el horario de EE.UU. si no está entre las modalidades", () => {
        const noUsHours: EligibilityRules = { ...rules, workModes: ["REMOTE", "HYBRID"] };
        const description = "Remote. Must work Pacific Time hours.";
        expect(checkEligibility(offer({ source: "remotive", description }), noUsHours).blockers).toEqual(["Horario de EE.UU."]);
    });
});
