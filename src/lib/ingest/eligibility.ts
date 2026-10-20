/**
 * Filtros que descartan ofertas a las que no tiene sentido postular: ubicación fuera de la región,
 * ciudadanía, permisos de trabajo, mudanza, modalidad, liderazgo y años de experiencia de más.
 * Funciones puras: se testean con fragmentos reales de ofertas.
 */

import { SENIORITY_LABELS, type Seniority } from "@/lib/positions/rules";

export const WORK_MODES = ["REMOTE", "REMOTE_US_HOURS", "HYBRID", "ONSITE"] as const;
export type WorkMode = typeof WORK_MODES[number];

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
    REMOTE: "Remoto desde Argentina",
    REMOTE_US_HOURS: "Remoto con horario de EE.UU.",
    HYBRID: "Híbrido en Buenos Aires",
    ONSITE: "Presencial en Buenos Aires",
};

export const DEFAULT_WORK_MODES: WorkMode[] = ["REMOTE", "REMOTE_US_HOURS", "HYBRID"];

export const SENIORITY_POLICIES = ["FLEXIBLE", "JUNIOR_ONLY", "ANY"] as const;
export type SeniorityPolicy = typeof SENIORITY_POLICIES[number];

export const SENIORITY_POLICY_LABELS: Record<SeniorityPolicy, string> = {
    FLEXIBLE: "Jr y SSr; Senior si piden hasta 5 años y el match es alto",
    JUNIOR_ONLY: "Solo Trainee, Jr y SSr (hasta 3 años)",
    ANY: "Cualquier nivel menos liderazgo",
};

/** Años pedidos a partir de los cuales se descarta la oferta, según la política. */
const MAX_YEARS: Record<SeniorityPolicy, number> = { FLEXIBLE: 5, JUNIOR_ONLY: 3, ANY: Infinity };
/** Match mínimo con el CV para un Senior con la política flexible. */
const SENIOR_MIN_SCORE = 60;
/** Más años que esto no es un requisito sino la antigüedad de la empresa ("25 years of experience in the market"). */
const MAX_PLAUSIBLE_YEARS = 15;

/** Portales que solo publican trabajos remotos. */
const REMOTE_ONLY_SOURCES = new Set(["remotive", "remoteok", "himalayas", "jobicy"]);

export interface OfferForEligibility {
    source: string;
    title: string;
    location: string | null;
    description: string;
    seniority: Seniority | null;
    /** Sueldo mínimo publicado en USD por mes, si se conoce. */
    salaryUsdMonthly?: number | null;
}

export interface EligibilityRules {
    workModes: WorkMode[];
    seniorityPolicy: SeniorityPolicy;
    minScore: number;
    /** Sueldo (USD por mes) que tiene que superar una oferta para aceptar mudarse; null = nunca. */
    minRelocationSalaryUsd: number | null;
}

export interface Eligibility {
    /** Motivos para descartar la oferta; vacío si sirve. */
    blockers: string[];
    /** Match mínimo con el CV que tiene que tener (a los Senior se les pide más). */
    minScore: number;
    workMode: WorkMode | null;
    yearsRequired: number | null;
    /** Resumen corto para las notas de la oferta, como "Remoto · Senior · pide 4 años". */
    summary: string;
}

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Lugares donde el candidato puede trabajar: Argentina, la región o cualquier lado
const ALLOWED_PLACES =
    /\b(argentina|buenos aires|caba|capital federal|gba|amba|latam|latin america|latinoamerica|south america|sudamerica|americas|worldwide|anywhere|global|any country|everywhere)\b/;
const BUENOS_AIRES =
    /\b(buenos aires|caba|capital federal|gba|amba|palermo|microcentro|puerto madero|belgrano|nunez|vicente lopez|olivos|san isidro|martinez)\b/;

const HYBRID = /\b(hybrid|hibrid[oa])\b/;
const ONSITE = /\b(on-?site|presencial|in-office)\b/;
const REMOTE = /\b(remote|remot[oa]|teletrabajo|work from home|home office)\b/;
const MODE_WORDS = /\b(remote|remot[oa]|fully|hybrid|hibrid[oa]|on-?site|presencial|in-office|office|work from home|wfh)\b/g;
const US_HOURS =
    /\b(est|edt|pst|pdt|cst|cdt)\b[^.\n]{0,20}\b(hours?|time|timezone|business)\b|\b(eastern|pacific|central|mountain) (standard )?time\b|\bu\.?s\.? (business |working )?(hours|time ?zones?)\b/;

const CITIZENSHIP =
    /\b(us|u\.s\.|united states|american|eu|uk|canadian) citizens?(hip)?\b|\bcitizenship (is )?required\b|\bgreen card\b|\bsecurity clearance\b|\bclearance (is )?required\b|\bciudadania (europea|espanola|italiana|estadounidense|comunitaria)\b/;
const RELOCATION =
    /\bwilling(ness)? to relocate\b|\brelocation (is )?required\b|\bmust (be willing to )?relocate\b|\bable to relocate\b|\bdisponibilidad (para|de) (mudarse|mudanza|relocalizarse|reubicarse|radicarse)\b/;

// Se buscan en el texto original (sin normalizar) para mostrar el lugar tal como está escrito
const RESIDENCY = [
    /\b(?:must|should|need to|required to|have to|has to)\s+(?:be\s+)?(?:currently\s+)?(?:reside|residing|live|living|based|located|resident)\s+(?:in|within)\s+(?:the\s+)?([^.;:\n()]{2,40})/i,
    /\bonly (?:open to|accepting|hiring) (?:candidates|applicants|people) (?:based|located|residing|living) in\s+(?:the\s+)?([^.;:\n()]{2,40})/i,
    /\b(?:debe|deber[aá]s?|excluyente)\s+(?:residir|vivir|estar radicad[oa])\s+en\s+([^.;:\n()]{2,40})/i,
];
const WORK_AUTHORIZATION = /\b(?:authori[sz]ed|eligible|permitted|legally able)\s+to\s+work\s+in\s+(?:the\s+)?([^.;:\n()]{2,30})/i;

const LEADERSHIP = /\b(lead|leader|lider|principal|staff|manager|head|director|architect|arquitect[oa]|vp|chief|cto|gerente|jef[ea])\b/;

const YEARS_PATTERNS = [
    // "3+ years of experience", "3-5 years experience", "4 years professional experience"
    /(?<![\d.])(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)'?(?=[^.\n]{0,40}?\b(?:experience|exp)\b)/gi,
    // "experience of 5+ years", "experience: 3 years"
    /\bexperience\b[^.\n]{0,25}?(?<![\d.])(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi,
    // "al menos 2 años de experiencia", "3 a 5 años de experiencia"
    /(?<![\d.])(\d{1,2})\s*\+?\s*(?:(?:-|–|a)\s*\d{1,2}\s*)?años?(?=[^.\n]{0,40}?\bexperiencia\b)/gi,
    // "experiencia mínima de 5 años"
    /\bexperiencia\b[^.\n]{0,30}?(?<![\d.])(\d{1,2})\s*\+?\s*años?/gi,
];

/** Años de experiencia que pide la oferta (el mayor de los requisitos); null si no los dice. */
export function extractYearsRequired(text: string): number | null {
    let max: number | null = null;
    for (const pattern of YEARS_PATTERNS) {
        for (const match of text.matchAll(pattern)) {
            const years = Number(match[1]);
            if (years > 0 && years <= MAX_PLAUSIBLE_YEARS && (max === null || years > max)) max = years;
        }
    }
    return max;
}

/** Cómo se trabaja según el título, la ubicación y la descripción; null si no hay pistas. */
export function detectWorkMode(offer: OfferForEligibility): WorkMode | null {
    // El título y la ubicación mandan: la descripción a veces menciona "remote" como beneficio
    const head = normalize(`${offer.title} ${offer.location ?? ""}`);
    const body = normalize(offer.description.slice(0, 4_000));

    let mode: WorkMode | null = null;
    if (HYBRID.test(head)) mode = "HYBRID";
    else if (ONSITE.test(head)) mode = "ONSITE";
    else if (REMOTE.test(head) || REMOTE_ONLY_SOURCES.has(offer.source)) mode = "REMOTE";
    else if (HYBRID.test(body)) mode = "HYBRID";
    else if (REMOTE.test(body)) mode = "REMOTE";
    else if (ONSITE.test(body)) mode = "ONSITE";

    if (mode === "REMOTE" && US_HOURS.test(`${head} ${body}`)) return "REMOTE_US_HOURS";
    return mode;
}

/** "Solo para USA, Canada" si la ubicación nombra lugares y ninguno es de la región. */
function locationBlocker(location: string | null): string | null {
    if (!location?.trim()) return null;
    const text = normalize(location);
    if (ALLOWED_PLACES.test(text)) return null;
    const places = text.replace(MODE_WORDS, " ").replace(/[^a-z]+/g, " ").trim();
    // La modalidad que antepone Get on Board ("Híbrido · Santiago, Chile") no aporta al motivo
    const shown = location.trim().replace(/^(remoto desde|h[ií]brido\s*·|presencial\s*·)\s*/i, "");
    return places ? `Solo para ${shown}` : null;
}

/** Corta el lugar donde empieza el resto de la frase: "United States without current..." → "United States". */
const trimPlace = (place: string) => place.split(/\s+(?:without|and|or|with|for|who|that|on|to|at|y|o|sin|con|para)\s+/i)[0].trim();

/** Lugar que la oferta exige (vivir o tener permiso de trabajo), si no es de la región. */
function requiredPlaceOutsideRegion(patterns: RegExp[], text: string): string | null {
    for (const pattern of patterns) {
        const place = text.match(pattern)?.[1]?.trim();
        if (place && !ALLOWED_PLACES.test(normalize(place))) return trimPlace(place);
    }
    return null;
}

const MODE_BLOCKERS: Record<WorkMode, string> = {
    REMOTE: "Remoto",
    REMOTE_US_HOURS: "Horario de EE.UU.",
    HYBRID: "Híbrido",
    ONSITE: "Presencial",
};

const MODE_SUMMARY: Record<WorkMode, string> = {
    REMOTE: "Remoto",
    REMOTE_US_HOURS: "Remoto, horario de EE.UU.",
    HYBRID: "Híbrido",
    ONSITE: "Presencial",
};

const formatUsd = (amount: number) => `${amount.toLocaleString("es-AR")} USD/mes`;

/** Decide si vale la pena postular a la oferta y con qué match mínimo. */
export function checkEligibility(offer: OfferForEligibility, rules: EligibilityRules): Eligibility {
    const blockers: string[] = [];
    const body = normalize(offer.description);
    const workMode = detectWorkMode(offer);
    const salary = offer.salaryUsdMonthly ?? null;

    // Mudarse vale solo si el sueldo publicado supera el mínimo que eligió el usuario. Cuando la oferta
    // pide mudanza, dónde queda y cómo se trabaja son consecuencia de eso: el motivo es uno solo.
    const relocationRequired = RELOCATION.test(body);
    const relocationAccepted =
        relocationRequired && rules.minRelocationSalaryUsd !== null && salary !== null && salary > rules.minRelocationSalaryUsd;

    if (relocationRequired && !relocationAccepted) {
        blockers.push(
            rules.minRelocationSalaryUsd === null
                ? "Pide mudanza"
                : salary === null
                  ? "Pide mudanza sin sueldo publicado"
                  : `Pide mudanza (sueldo ${formatUsd(salary)})`
        );
    }

    const outsideLocation = relocationRequired ? null : locationBlocker(offer.location);
    if (outsideLocation) blockers.push(outsideLocation);

    if (CITIZENSHIP.test(body)) blockers.push("Pide ciudadanía o clearance");

    const residency = relocationRequired ? null : requiredPlaceOutsideRegion(RESIDENCY, offer.description);
    if (residency) blockers.push(`Exige vivir en ${residency}`);

    // Mudarse no da permiso de trabajo: esto se controla siempre
    const authorization = requiredPlaceOutsideRegion([WORK_AUTHORIZATION], offer.description);
    if (authorization) blockers.push(`Pide permiso de trabajo en ${authorization}`);

    // Si la ubicación ya es de afuera, la modalidad no agrega nada al motivo
    const checkMode = !relocationRequired && !outsideLocation;
    if (checkMode && workMode && !rules.workModes.includes(workMode)) {
        blockers.push(MODE_BLOCKERS[workMode]);
    } else if (checkMode && (workMode === "HYBRID" || workMode === "ONSITE")) {
        const where = normalize(`${offer.location ?? ""} ${offer.title} ${offer.description.slice(0, 4_000)}`);
        if (!BUENOS_AIRES.test(where)) blockers.push(`${MODE_SUMMARY[workMode]} fuera de Buenos Aires`);
    }

    const yearsRequired = extractYearsRequired(offer.description);
    let minScore = rules.minScore;
    if (offer.seniority === "LEAD" || LEADERSHIP.test(normalize(offer.title))) {
        blockers.push("Puesto de liderazgo");
    } else if (offer.seniority === "SENIOR" && rules.seniorityPolicy === "JUNIOR_ONLY") {
        blockers.push("Senior");
    } else if (yearsRequired !== null && yearsRequired > MAX_YEARS[rules.seniorityPolicy]) {
        blockers.push(offer.seniority === "SENIOR" ? `Senior: pide ${yearsRequired} años` : `Pide ${yearsRequired} años de experiencia`);
    } else if (offer.seniority === "SENIOR" && rules.seniorityPolicy === "FLEXIBLE") {
        minScore = Math.max(minScore, SENIOR_MIN_SCORE);
    }

    const summary = [
        workMode && MODE_SUMMARY[workMode],
        offer.seniority && SENIORITY_LABELS[offer.seniority],
        yearsRequired !== null && `pide ${yearsRequired} ${yearsRequired === 1 ? "año" : "años"}`,
        relocationAccepted && "pide mudanza",
        salary !== null && formatUsd(salary),
    ]
        .filter(Boolean)
        .join(" · ");

    return { blockers, minScore, workMode, yearsRequired, summary };
}
