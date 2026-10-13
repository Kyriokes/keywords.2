import { aliasKey } from "../../src/lib/keywords/core";

export interface PlanKeyword {
    id: string;
    name: string;
    isApproved: boolean;
    /** Claves de alias que ya tiene guardadas. Las keywords anteriores al diccionario no tienen ninguna. */
    aliasKeys: string[];
}

export type PlanStep =
    | { type: "alias"; keywordId: string; aliasText: string }
    | { type: "merge"; sourceId: string; targetId: string };

/**
 * Decide cómo llevar al diccionario las keywords que todavía no tienen alias:
 * si su clave ya pertenece a otra keyword se fusionan con ella; si no, se les crea el alias.
 * Dos variantes sin verificar del mismo término ("node.js" y "nodejs") terminan en una sola.
 */
export function planKeywordBackfill(keywords: PlanKeyword[]): PlanStep[] {
    const ownerByKey = new Map<string, string>();
    for (const keyword of keywords) {
        for (const key of keyword.aliasKeys) {
            ownerByKey.set(key, keyword.id);
        }
    }

    const steps: PlanStep[] = [];
    const withoutAlias = keywords
        .filter((keyword) => keyword.aliasKeys.length === 0)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    for (const keyword of withoutAlias) {
        const key = aliasKey(keyword.name);
        if (!key) continue;

        const ownerId = ownerByKey.get(key);
        if (!ownerId) {
            ownerByKey.set(key, keyword.id);
            steps.push({ type: "alias", keywordId: keyword.id, aliasText: key });
        } else if (!keyword.isApproved) {
            // Una entrada ya verificada nunca se borra: en ese caso se deja como está
            steps.push({ type: "merge", sourceId: keyword.id, targetId: ownerId });
        }
    }

    return steps;
}
