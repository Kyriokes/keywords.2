// Resúmenes de las estadísticas de la búsqueda. Todo puro, sin Prisma: lo usan la página y la herramienta del agente.
import { sourceLabel, type SourceStats } from "@/lib/ingest/stats";

export const STATS_PERIODS = [7, 30, 90] as const;
export type StatsPeriod = typeof STATS_PERIODS[number];
export const DEFAULT_PERIOD: StatsPeriod = 30;

export interface OfferRow {
    source: string;
    board: string | null;
    company: string | null;
    roleName: string | null;
    decision: string;
    reason: string | null;
    score: number | null;
}
export interface ApplicationRow {
    source: string | null;
    status: string;
    company: string | null;
}
export interface AnswerRow {
    question: string;
    templateId: string | null;
    origin: string | null;
}

/** Ofertas de tus puestos: las que se evaluaron con los filtros. */
const OF_MY_ROLES = new Set(["QUEUED", "PASSES", "REJECTED"]);
const PASSED = new Set(["QUEUED", "PASSES"]);
/** Postulaciones que se enviaron, con o sin respuesta de la empresa. */
const APPLIED = new Set(["APPLIED", "INTERVIEW", "REJECTED"]);
/** Postulaciones que el usuario aprobó, se hayan enviado o no. */
const APPROVED = new Set(["APPROVED", "NEEDS_USER", ...APPLIED]);

const byLabel = (a: string, b: string) => a.localeCompare(b, "es");

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
    return counts;
}

export interface SourceRank {
    source: string;
    label: string;
    /** Filas del período. */
    offers: number;
    /** QUEUED + PASSES + REJECTED. */
    ofMyRoles: number;
    /** QUEUED + PASSES. */
    passed: number;
    queued: number;
    rejected: number;
    /** Postulaciones con status APPLIED, INTERVIEW o REJECTED. */
    applied: number;
    interviews: number;
    /** Qué parte de las ofertas de tus puestos pasa los filtros; null si no hubo ninguna. */
    yield: number | null;
    /** Error de la última búsqueda, sin el "(url)" final; varios boards se unen con " · " como "stripe: 404 Not Found". */
    lastError: string | null;
}

/** El mensaje de error de un pedido termina con la URL entre paréntesis: no aporta en la tabla. */
const withoutUrl = (error: string) => error.replace(/\s*\([^()]*\)\s*$/, "");

/**
 * Un portal por fila, también los que solo tienen postulaciones (manual, agent) o solo aparecen en la última búsqueda
 * (un portal que falló sigue en la lista con su error). Orden: ofMyRoles desc, offers desc, label.
 */
export function rankSources(
    offers: OfferRow[],
    applications: ApplicationRow[],
    lastRunBySource: Record<string, SourceStats> = {}
): SourceRank[] {
    const ranks = new Map<string, SourceRank>();
    const rankOf = (source: string) => {
        let rank = ranks.get(source);
        if (!rank) {
            rank = {
                source,
                label: sourceLabel(source || null),
                offers: 0,
                ofMyRoles: 0,
                passed: 0,
                queued: 0,
                rejected: 0,
                applied: 0,
                interviews: 0,
                yield: null,
                lastError: null,
            };
            ranks.set(source, rank);
        }
        return rank;
    };

    for (const offer of offers) {
        const rank = rankOf(offer.source);
        rank.offers++;
        if (OF_MY_ROLES.has(offer.decision)) rank.ofMyRoles++;
        if (PASSED.has(offer.decision)) rank.passed++;
        if (offer.decision === "QUEUED") rank.queued++;
        if (offer.decision === "REJECTED") rank.rejected++;
    }
    for (const application of applications) {
        const rank = rankOf(application.source ?? "");
        if (APPLIED.has(application.status)) rank.applied++;
        if (application.status === "INTERVIEW") rank.interviews++;
    }

    // La clave de la búsqueda es "remotive" o "greenhouse:stripe": los boards se juntan en su ATS
    const errors = new Map<string, string[]>();
    for (const [key, stats] of Object.entries(lastRunBySource)) {
        const [source, board] = key.split(/:(.*)/);
        rankOf(source);
        if (!stats.error) continue;
        const message = withoutUrl(stats.error);
        errors.set(source, [...(errors.get(source) ?? []), board ? `${board}: ${message}` : message]);
    }

    return Array.from(ranks.values())
        .map((rank) => ({
            ...rank,
            yield: rank.ofMyRoles ? Math.round((rank.passed / rank.ofMyRoles) * 100) : null,
            lastError: errors.get(rank.source)?.join(" · ") ?? null,
        }))
        .sort((a, b) => b.ofMyRoles - a.ofMyRoles || b.offers - a.offers || byLabel(a.label, b.label));
}

/** Motivos que llevan números o lugares, y la categoría con la que se agrupan. La primera que coincide gana. */
const REASON_CATEGORIES: [RegExp, string][] = [
    [/^Senior: pide /, "Senior con más años de los que aceptás"],
    [/^Pide \d+ años/, "Pide más años de los que aceptás"],
    [/^Match \d+%/, "Match bajo con el CV"],
    [/^Solo para /, "Solo para otro país"],
    [/^Exige vivir en /, "Exige vivir en otro país"],
    [/^Pide permiso de trabajo en /, "Pide permiso de trabajo de otro país"],
    [/^Pide mudanza/, "Pide mudanza"],
    [/^El título pide /, "El título pide un stack que no tenés"],
];

/** Agrupa un motivo de descarte quitándole números y lugares; lo que ya es una categoría vuelve igual. */
export function reasonCategory(reason: string): string {
    const text = reason.trim();
    return REASON_CATEGORIES.find(([pattern]) => pattern.test(text))?.[1] ?? text;
}

export interface ReasonCount {
    label: string;
    count: number;
}

/** Separa los motivos combinados con " · ", los agrupa con reasonCategory y ordena por count desc y label. */
export function summarizeReasons(reasons: (string | null)[]): ReasonCount[] {
    const labels = reasons.flatMap((reason) => (reason ?? "").split(" · ").map((part) => part.trim()).filter(Boolean)).map(reasonCategory);
    return Array.from(countBy(labels, (label) => label), ([label, count]) => ({ label, count })).sort(
        (a, b) => b.count - a.count || byLabel(a.label, b.label)
    );
}

export interface Funnel {
    offers: number;
    ofMyRoles: number;
    passedFilters: number;
    queued: number;
    approved: number;
    applied: number;
    interviews: number;
}

/** approved = status APPROVED, NEEDS_USER, APPLIED, INTERVIEW o REJECTED; applied e interviews como en SourceRank. */
export function buildFunnel(offers: OfferRow[], applications: ApplicationRow[]): Funnel {
    const decisions = offers.map((offer) => offer.decision);
    const statuses = applications.map((application) => application.status);
    return {
        offers: offers.length,
        ofMyRoles: decisions.filter((decision) => OF_MY_ROLES.has(decision)).length,
        passedFilters: decisions.filter((decision) => PASSED.has(decision)).length,
        queued: decisions.filter((decision) => decision === "QUEUED").length,
        approved: statuses.filter((status) => APPROVED.has(status)).length,
        applied: statuses.filter((status) => APPLIED.has(status)).length,
        interviews: statuses.filter((status) => status === "INTERVIEW").length,
    };
}

export interface CompanyRank {
    company: string;
    offers: number;
    passed: number;
    /** "greenhouse:clara" si alguna oferta vino de su ATS: se puede seguir en la cola. */
    board: string | null;
}

/** Solo ofertas de tus puestos; board = "source:board" de cualquier oferta de esa empresa que venga de un ATS. Orden: offers desc, company. */
export function rankCompanies(offers: OfferRow[], max = 15): CompanyRank[] {
    const companies = new Map<string, CompanyRank>();
    for (const offer of offers) {
        const name = offer.company?.trim();
        if (!name || !OF_MY_ROLES.has(offer.decision)) continue;
        // "Clara" y "clara" son la misma empresa; se muestra como apareció primero
        const key = name.toLowerCase();
        const company = companies.get(key) ?? { company: name, offers: 0, passed: 0, board: null };
        company.offers++;
        if (PASSED.has(offer.decision)) company.passed++;
        if (!company.board && offer.board) company.board = `${offer.source}:${offer.board}`;
        companies.set(key, company);
    }
    return Array.from(companies.values())
        .sort((a, b) => b.offers - a.offers || byLabel(a.company, b.company))
        .slice(0, max);
}

export interface RoleRank {
    role: string;
    offers: number;
    /** Es uno de tus puestos. */
    desired: boolean;
}

const UNCLASSIFIED = "Sin clasificar";

/**
 * roleName null → "Sin clasificar"; desired = tiene alguna oferta que no sea OTHER_ROLE ni IN_ACCOUNT. Orden: offers desc, role.
 * Las que ya estaban en la cuenta no se clasifican: no cuentan, para no inflar "Sin clasificar".
 */
export function rankRoles(offers: OfferRow[], max = 10): RoleRank[] {
    const roles = new Map<string, RoleRank>();
    for (const offer of offers) {
        if (offer.decision === "IN_ACCOUNT") continue;
        const name = offer.roleName ?? UNCLASSIFIED;
        const role = roles.get(name) ?? { role: name, offers: 0, desired: false };
        role.offers++;
        if (offer.decision !== "OTHER_ROLE") role.desired = true;
        roles.set(name, role);
    }
    return Array.from(roles.values())
        .sort((a, b) => b.offers - a.offers || byLabel(a.role, b.role))
        .slice(0, max);
}

export interface TemplateUsage {
    templateId: string;
    question: string;
    used: number;
}
export interface RepeatedQuestion {
    question: string;
    count: number;
}
export interface AnswerStats {
    total: number;
    byOrigin: Record<string, number>;
    templates: TemplateUsage[];
    repeatedWithoutTemplate: RepeatedQuestion[];
}

/** "¿Por qué querés  trabajar acá?" → "Por qué querés trabajar acá". */
const cleanQuestion = (question: string) => question.replace(/^[\s¿?:]+|[\s¿?:]+$/g, "").replace(/\s+/g, " ");

/**
 * byOrigin usa "SIN_DATO" para origin null. Las preguntas se comparan en minúsculas, sin "¿", "?" ni ":" en los bordes
 * y con espacios colapsados; se muestra la primera que apareció, limpia.
 */
export function summarizeAnswers(answers: AnswerRow[], templates: { id: string; question: string }[], minRepeats = 2): AnswerStats {
    const byOrigin = Object.fromEntries(countBy(answers, (answer) => answer.origin ?? "SIN_DATO"));

    const uses = countBy(answers.filter((answer) => answer.templateId), (answer) => answer.templateId as string);
    const usage = templates
        .map((template) => ({ templateId: template.id, question: template.question, used: uses.get(template.id) ?? 0 }))
        .sort((a, b) => b.used - a.used);

    const repeated = new Map<string, RepeatedQuestion>();
    for (const answer of answers) {
        if (answer.templateId) continue;
        const question = cleanQuestion(answer.question);
        if (!question) continue;
        const key = question.toLowerCase();
        const entry = repeated.get(key) ?? { question, count: 0 };
        entry.count++;
        repeated.set(key, entry);
    }

    return {
        total: answers.length,
        byOrigin,
        templates: usage,
        repeatedWithoutTemplate: Array.from(repeated.values())
            .filter((entry) => entry.count >= minRepeats)
            .sort((a, b) => b.count - a.count || byLabel(a.question, b.question)),
    };
}
