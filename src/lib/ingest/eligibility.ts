/**
 * Filtros que descartan ofertas a las que no tiene sentido postular: ubicación fuera de la región,
 * ciudadanía, permisos de trabajo, mudanza, modalidad, liderazgo, años de experiencia de más, otro
 * idioma, "talent pools", tareas para entrenar IA, sueldo publicado por debajo del mínimo y frases
 * que el usuario pidió evitar. Funciones puras: se testean con fragmentos reales de ofertas.
 */

import { detectAdLanguage, type AdLanguage } from "@/lib/applications/language";
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
    /** Nivel según el título (clasificador); null si el título no lo dice. */
    seniority: Seniority | null;
    /** Nivel que informa el portal (Himalayas lo manda), para cuando el título no lo dice. */
    seniorityHint?: Seniority | null;
    /** Sueldo mínimo publicado en USD por mes, si se conoce. */
    salaryUsdMonthly?: number | null;
    /** Máximo del rango publicado en USD por mes, si se conoce. */
    salaryMaxUsdMonthly?: number | null;
}

export interface EligibilityRules {
    workModes: WorkMode[];
    seniorityPolicy: SeniorityPolicy;
    minScore: number;
    /** Sueldo (USD por mes) que tiene que superar una oferta para aceptar mudarse; null = nunca. */
    minRelocationSalaryUsd: number | null;
    /** Sueldo mínimo (USD por mes): una oferta que publica menos se descarta; null = no mirar el sueldo. */
    minSalaryUsdMonthly?: number | null;
    /** Frases que descartan la oferta si aparecen en el título o la descripción (preferencias del usuario). */
    avoidPhrases?: string[];
}

export interface Eligibility {
    /** Motivos para descartar la oferta; vacío si sirve. */
    blockers: string[];
    /** Match mínimo con el CV que tiene que tener (a los Senior se les pide más). */
    minScore: number;
    workMode: WorkMode | null;
    yearsRequired: number | null;
    /** Nivel que se usó: el del título, el del portal o el deducido de la descripción. */
    seniority: Seniority | null;
    /** Idioma del aviso. */
    language: AdLanguage;
    /** Avisos que no bloquean pero conviene saber antes de postular; frenan la aprobación automática. */
    warnings: string[];
    /** Resumen corto para las notas de la oferta, como "Remoto · Senior · pide 4 años". */
    summary: string;
}

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Lugares donde el candidato puede trabajar: Argentina, la región o cualquier lado
const ALLOWED_PLACES =
    /\b(argentina|buenos aires|caba|capital federal|gba|amba|latam|latin america|latinoamerica|south america|sudamerica|americas|worldwide|anywhere|global|any country|everywhere)\b/;
const BUENOS_AIRES =
    /\b(buenos aires|caba|capital federal|gba|amba|palermo|microcentro|puerto madero|belgrano|nunez|vicente lopez|olivos|san isidro|martinez)\b/;
/** Regiones o países que en el título señalan que la búsqueda es solo para ahí. */
const TITLE_REGION =
    /\b(europe|european|emea|eu|uk|united kingdom|us only|usa only|us-only|united states|canada|india|apac|asia|australia|germany|poland|portugal|spain|españa|mexico|méxico|brazil|brasil|colombia|chile|peru|perú)\b/i;

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

// En el título alcanza la palabra; en la descripción, solo frases que no sean "paid and unpaid leave"
const UNPAID_TITLE = /\b(unpaid|no remunerad[ao]s?|ad honorem|volunteer|voluntari[oa]|voluntariado)\b/;
const UNPAID_BODY =
    /\b(unpaid (internship|position|role)|this (is an? )?unpaid|pasantia no remunerada|no remunerad[ao]|ad honorem|volunteer (position|role|opportunity|basis|work|developer|engineer)|this is an? volunteer|unpaid volunteer|voluntariado|puesto voluntario|trabajo voluntario)\b/;
/** Trabajos de tareas para entrenar o evaluar modelos de IA (tipo Remotasks), no puestos de desarrollo. */
const AI_TASKS = /\b(coding tasks?|ai (coding |training |evaluation )?tasks?|ai trainer|ai training|ai tutor|data annotation|annotator|rlhf)\b|\btareas\b.*\b(ia|ai)\b/;
/** Lo mismo cuando el título parece normal y el cuerpo cuenta que se cobra por tarea o se entrenan modelos. */
const AI_TASKS_BODY =
    /\b(paid per task|pay(ment)? per task|per[- ]task (basis|pay|payment|rate)|train(ing)? (ai|llm|language) models?|rlhf|data (annotation|labeling|labelling)|coding tasks for ai|ai evaluation tasks?)\b/;
/** Convocatorias sin una vacante concreta: se guarda el CV "para más adelante". */
const NOT_A_JOB =
    /\b(talent pool|talent community|always recruiting|evergreen (role|posting|requisition|position)|general application|open application|spontaneous application|banco de talentos?|base de talentos?|pool de talentos?|comunidad de talento|candidatura espontanea|postulacion espontanea)\b/;

const LEADERSHIP = /\b(lead|leader|lider|principal|staff|manager|head|director|architect|arquitect[oa]|vp|chief|cto|gerente|jef[ea])\b/;

// Nivel escrito como número o letra en el título: "Software Engineer 4", "Engineer III", "L5"
const ROLE_WORD = "(?:engineer|developer|desarrollador[a]?|programmer|programador[a]?|swe|sde)";
const TITLE_LEVEL_SENIOR = new RegExp(`\\b${ROLE_WORD}\\s*(?:iii|iv|v|3|4|5)\\b|\\b[el][4-7]\\b`);
const TITLE_LEVEL_SEMI = new RegExp(`\\b${ROLE_WORD}\\s*(?:ii|2)\\b|\\b[el]3\\b`);
// En la descripción se mira solo el comienzo, donde se presenta el puesto
const DESCRIPTION_HEAD = 600;
const SENIOR_ROLE = /\bsenior\s+(?:[a-z.+#/-]+\s+){0,3}?(?:engineer|developer|desarrollador[a]?|programmer|programador[a]?|ingenier[oa])\b/;
const JUNIOR_WORDS = /\b(junior|jr\.?|entry[- ]level|recien graduad[oa]s?|trainee|sin experiencia|no (prior )?experience (required|needed))\b/;
const MID_WORDS = /\b(semi ?senior|ssr|mid[- ]level|intermedio)\b/;

// Idiomas que una oferta puede exigir y en los que el usuario no trabaja; se buscan en el texto normalizado
const REQUIRED_LANGUAGES: [RegExp, string][] = [
    [/\b(german|deutsch|aleman)\b/, "alemán"],
    [/\b(french|frances)\b/, "francés"],
    [/\b(italian|italiano)\b/, "italiano"],
    [/\b(portuguese|portugues)\b/, "portugués"],
    [/\b(russian|ruso)\b/, "ruso"],
    [/\b(dutch|neerlandes|holandes)\b/, "neerlandés"],
    [/\b(polish|polaco)\b/, "polaco"],
    [/\b(greek|griego)\b/, "griego"],
    [/\b(japanese|japones)\b/, "japonés"],
    [/\b(chinese|mandarin|chino)\b/, "chino"],
    [/\b(arabic|arabe)\b/, "árabe"],
    [/\b(hebrew|hebreo)\b/, "hebreo"],
    [/\b(turkish|turco)\b/, "turco"],
    [/\b(swedish|sueco)\b/, "sueco"],
    [/\b(norwegian|noruego)\b/, "noruego"],
    [/\b(danish|danes)\b/, "danés"],
    [/\b(czech|checo)\b/, "checo"],
    [/\b(hungarian|hungaro)\b/, "húngaro"],
    [/\b(romanian|rumano)\b/, "rumano"],
];
const LANGUAGE_DEMAND =
    /\b(fluent|fluency|native|proficien(t|cy)|advanced|business|professional|required|mandatory|must|speaker|speaking|c1|c2|b2|fluido|avanzado|excluyente|indispensable|nativo|requerido|obligatorio)\b/;
const LANGUAGE_OPTIONAL = /\b(plus|nice to have|bonus|preferred|valorad[oa]|deseable|advantage|would be|opcional|optional)\b/;
/** Caracteres alrededor del idioma donde tiene que estar la exigencia. */
const LANGUAGE_WINDOW = 40;

/** Viajes obligatorios o periódicos: no bloquean, pero el usuario tiene que saberlo. */
const TRAVEL =
    /\b(travel|viajar|viajes?)\b[^.\n]{0,30}\b(required|mandatory|monthly|quarterly|weekly|mensual(es)?|trimestral(es)?|semanal(es)?|\d{1,2}\s?%)|\b(required|mandatory|monthly|quarterly|weekly|mensual|trimestral|\d{1,2}\s?%)\b[^.\n]{0,30}\b(travel|viajar|viajes?)\b/;

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

/**
 * Nivel del puesto cuando el título no lo nombra: un número o letra de nivel en el título
 * ("Engineer 4", "L5") o cómo presenta el puesto el comienzo de la descripción.
 */
export function inferSeniority(title: string, description: string): Seniority | null {
    const head = normalize(title);
    if (TITLE_LEVEL_SENIOR.test(head)) return "SENIOR";
    if (TITLE_LEVEL_SEMI.test(head)) return "SEMI_SENIOR";
    const intro = normalize(description.slice(0, DESCRIPTION_HEAD));
    if (JUNIOR_WORDS.test(intro)) return "JUNIOR";
    if (MID_WORDS.test(intro)) return "SEMI_SENIOR";
    if (SENIOR_ROLE.test(intro)) return "SENIOR";
    return null;
}

/** Idioma que la oferta exige hablar (además de inglés o castellano); null si no pide ninguno. */
export function requiredLanguage(text: string): string | null {
    const body = normalize(text);
    for (const [pattern, label] of REQUIRED_LANGUAGES) {
        for (const match of body.matchAll(new RegExp(pattern.source, "g"))) {
            const window = body.slice(Math.max(0, match.index - LANGUAGE_WINDOW), match.index + match[0].length + LANGUAGE_WINDOW);
            if (LANGUAGE_DEMAND.test(window) && !LANGUAGE_OPTIONAL.test(window)) return label;
        }
    }
    return null;
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

/** "Solo para Europe" si el título dice para qué región es y no es la nuestra. */
function titleRegionBlocker(title: string): string | null {
    if (ALLOWED_PLACES.test(normalize(title))) return null;
    const region = title.match(TITLE_REGION)?.[0];
    return region ? `Solo para ${region}` : null;
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
    const warnings: string[] = [];
    const title = normalize(offer.title);
    const body = normalize(offer.description);
    const workMode = detectWorkMode(offer);
    const salary = offer.salaryUsdMonthly ?? null;
    const salaryMax = offer.salaryMaxUsdMonthly ?? salary;
    const seniority = offer.seniority ?? offer.seniorityHint ?? inferSeniority(offer.title, offer.description);
    const language = detectAdLanguage(offer.description);

    if (language === "other") blockers.push("Aviso en otro idioma");

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

    const outsideLocation = relocationRequired ? null : locationBlocker(offer.location) ?? titleRegionBlocker(offer.title);
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

    const otherLanguage = requiredLanguage(offer.description);
    if (otherLanguage) blockers.push(`Pide ${otherLanguage}`);

    if (NOT_A_JOB.test(title) || NOT_A_JOB.test(body)) blockers.push("No es una vacante concreta");
    if (UNPAID_TITLE.test(title) || UNPAID_BODY.test(body)) blockers.push("Sin sueldo");
    if (AI_TASKS.test(title) || AI_TASKS_BODY.test(body)) blockers.push("Tareas para entrenar IA");

    if (rules.minSalaryUsdMonthly != null && salaryMax !== null && salaryMax < rules.minSalaryUsdMonthly) {
        blockers.push(`Sueldo publicado por debajo de tu mínimo (${formatUsd(salaryMax)})`);
    }

    const avoided = (rules.avoidPhrases ?? []).find((phrase) => {
        const key = normalize(phrase).trim();
        return key && (title.includes(key) || body.includes(key));
    });
    if (avoided) blockers.push(`Evitás: ${avoided}`);

    const yearsRequired = extractYearsRequired(offer.description);
    let minScore = rules.minScore;
    if (seniority === "LEAD" || LEADERSHIP.test(title)) {
        blockers.push("Puesto de liderazgo");
    } else if (seniority === "SENIOR" && rules.seniorityPolicy === "JUNIOR_ONLY") {
        blockers.push("Senior");
    } else if (yearsRequired !== null && yearsRequired > MAX_YEARS[rules.seniorityPolicy]) {
        blockers.push(seniority === "SENIOR" ? `Senior: pide ${yearsRequired} años` : `Pide ${yearsRequired} años de experiencia`);
    } else if (seniority === "SENIOR" && rules.seniorityPolicy === "FLEXIBLE") {
        minScore = Math.max(minScore, SENIOR_MIN_SCORE);
        warnings.push("Senior");
    }

    if (relocationAccepted) warnings.push("pide mudanza");
    if (workMode === "REMOTE_US_HOURS") warnings.push("horario de EE.UU.");
    if (workMode === null) warnings.push("modalidad sin indicar");
    if (TRAVEL.test(body)) warnings.push("menciona viajes");

    const summary = [
        workMode && MODE_SUMMARY[workMode],
        seniority && SENIORITY_LABELS[seniority],
        yearsRequired !== null && `pide ${yearsRequired} ${yearsRequired === 1 ? "año" : "años"}`,
        relocationAccepted && "pide mudanza",
        salary !== null && formatUsd(salary),
    ]
        .filter(Boolean)
        .join(" · ");

    return { blockers, minScore, workMode, yearsRequired, seniority, language, warnings, summary };
}
