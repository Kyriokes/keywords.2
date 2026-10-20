/**
 * Empresas para seguir sugeridas a partir de los links de las ofertas del usuario: si una oferta
 * (o el formulario donde se postuló) está en la página de empleos de un ATS conocido, esa empresa
 * puede tener más vacantes. Funciones puras.
 */

import { parseAtsBoard, type AtsSource } from "./sources";

// Solo los dominios que leen las APIs de sources.ts (las variantes .eu usan otra API)
const ATS_HOSTS: [RegExp, AtsSource][] = [
    [/^(job-boards|boards)\.greenhouse\.io$/, "greenhouse"],
    [/^jobs\.lever\.co$/, "lever"],
    [/^jobs\.ashbyhq\.com$/, "ashby"],
    [/^apply\.workable\.com$/, "workable"],
    [/^jobs\.smartrecruiters\.com$/, "smartrecruiters"],
];

/** Primeros tramos de ruta que no son el nombre de una empresa ("/embed/job_app", el link corto "/j/..."). */
const NOT_A_BOARD = new Set(["embed", "j"]);

/** "https://jobs.lever.co/webfx/123" → "lever:webfx"; null si el link no es de una página de empleos conocida. */
export function atsBoardFromUrl(url: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    const source = ATS_HOSTS.find(([host]) => host.test(parsed.hostname.toLowerCase()))?.[1];
    const board = parsed.pathname.split("/").filter(Boolean)[0];
    if (!source || !board || NOT_A_BOARD.has(board.toLowerCase())) return null;

    const valid = parseAtsBoard(`${source}:${board}`);
    return valid ? `${valid.source}:${valid.board}` : null;
}

export interface BoardSuggestion {
    board: string;
    /** Ofertas del usuario que salieron de esa empresa. */
    offers: number;
}

/**
 * Empresas que aparecen en los links de las ofertas y que todavía no se siguen, de la que más
 * ofertas tiene a la que menos. Cada oferta puede traer varios links (publicación y formulario).
 */
export function suggestAtsBoards(offers: (string | null | (string | null)[])[], following: string[], max = 10): BoardSuggestion[] {
    const followed = new Set(following.map((board) => board.trim().toLowerCase()));
    const counts = new Map<string, number>();

    for (const offer of offers) {
        const links = (Array.isArray(offer) ? offer : [offer]).filter((link): link is string => !!link);
        const boards = new Set(links.map(atsBoardFromUrl).filter((board): board is string => !!board));
        for (const board of boards) {
            if (!followed.has(board)) counts.set(board, (counts.get(board) ?? 0) + 1);
        }
    }

    return Array.from(counts, ([board, count]) => ({ board, offers: count }))
        .sort((a, b) => b.offers - a.offers || a.board.localeCompare(b.board))
        .slice(0, max);
}
