// Carga las semillas del diccionario (keywords: tech.json; roles: roles.json) en la base
// indicada por DATABASE_URL.
// Se puede correr todas las veces que haga falta: no pisa lo que ya editó un admin.
//
//   pnpm dictionary:seed             aplica los cambios
//   pnpm dictionary:seed --dry-run   solo informa qué haría
import { PrismaClient } from "@prisma/client";
import { mergeKeywordInto } from "../../src/lib/keywords/merge";
import { describeTarget } from "./target";
import { findRoleProblems, loadRoles } from "./roles-data";
import { findSeedProblems, loadSeed } from "./seed-data";
import { seedRoles } from "./seed-roles";

const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

async function main() {
    const seed = loadSeed();
    const problems = [...findSeedProblems(seed), ...findRoleProblems(loadRoles())];
    if (problems.length > 0) {
        console.error("La semilla tiene errores:\n- " + problems.join("\n- "));
        process.exit(1);
    }

    console.log(`Base: ${describeTarget()} | ${dryRun ? "SIMULACIÓN (no escribe)" : "APLICANDO CAMBIOS"}`);
    console.log(`Semilla: ${seed.length} entradas, ${seed.reduce((n, entry) => n + entry.aliases.length, 0)} alias`);

    // ── 1. Keywords ─────────────────────────────────────────────────────────
    const existing = await prisma.keyword.findMany({
        where: { canonicalText: { in: seed.map((entry) => entry.canonicalText) } },
        select: { id: true, canonicalText: true, isApproved: true, isBlocked: true },
    });
    const existingByText = new Map(existing.map((keyword) => [keyword.canonicalText, keyword]));

    const toCreate = seed.filter((entry) => !existingByText.has(entry.canonicalText));
    // Ya existía como término sin verificar: pasa a ser la entrada del diccionario y conserva sus vínculos
    const toPromote = seed.filter((entry) => {
        const keyword = existingByText.get(entry.canonicalText);
        return keyword && !keyword.isApproved && !keyword.isBlocked;
    });
    const blocked = seed.filter((entry) => existingByText.get(entry.canonicalText)?.isBlocked);

    console.log(`Keywords: ${toCreate.length} nuevas, ${toPromote.length} que pasan a verificadas, ` +
        `${existing.length - toPromote.length - blocked.length} ya verificadas (no se tocan)`);
    if (blocked.length > 0) {
        console.log(`  Bloqueadas por un admin, se dejan así: ${blocked.map((entry) => entry.name).join(", ")}`);
    }

    if (!dryRun) {
        await prisma.keyword.createMany({
            data: toCreate.map((entry) => ({
                canonicalText: entry.canonicalText,
                displayName: entry.name,
                category: entry.category,
                isApproved: true,
                source: entry.source,
            })),
            skipDuplicates: true,
        });
        for (const entry of toPromote) {
            await prisma.keyword.update({
                where: { canonicalText: entry.canonicalText },
                data: { displayName: entry.name, category: entry.category, isApproved: true, source: entry.source },
            });
        }
    }

    // ── 2. Alias ────────────────────────────────────────────────────────────
    const keywords = await prisma.keyword.findMany({
        where: { canonicalText: { in: seed.map((entry) => entry.canonicalText) } },
        select: { id: true, canonicalText: true },
    });
    const idByText = new Map(keywords.map((keyword) => [keyword.canonicalText, keyword.id]));

    const owners = await prisma.keywordAlias.findMany({
        where: { aliasText: { in: seed.flatMap((entry) => entry.aliases.map((alias) => alias.aliasText)) } },
        select: {
            aliasText: true,
            exactText: true,
            keywordId: true,
            keyword: { select: { isApproved: true, displayName: true, canonicalText: true } },
        },
    });
    const ownerByAlias = new Map(owners.map((owner) => [owner.aliasText, owner]));

    const newAliases: Array<{ aliasText: string; exactText: string | null; keywordId: string }> = [];
    const conflicts: string[] = [];
    // Términos sin verificar ya absorbidos: sus otros alias pasaron a la entrada en la misma fusión
    const mergedSources = new Set<string>();
    let exactUpdated = 0;

    for (const entry of seed) {
        if (existingByText.get(entry.canonicalText)?.isBlocked) continue;
        // En simulación las keywords nuevas todavía no tienen id
        const keywordId = idByText.get(entry.canonicalText) ?? `(nueva) ${entry.name}`;

        for (const alias of entry.aliases) {
            const owner = ownerByAlias.get(alias.aliasText);

            if (!owner) {
                newAliases.push({ ...alias, keywordId });
            } else if (owner.keywordId === keywordId) {
                if (owner.exactText !== alias.exactText) {
                    exactUpdated++;
                    if (!dryRun) {
                        await prisma.keywordAlias.update({
                            where: { aliasText: alias.aliasText },
                            data: { exactText: alias.exactText },
                        });
                    }
                }
            } else if (owner.keyword.isApproved) {
                // Otra entrada verificada ya usa ese alias: no se pisa, se informa
                conflicts.push(`"${alias.aliasText}" (de ${entry.name}) ya pertenece a ` +
                    `${owner.keyword.displayName || owner.keyword.canonicalText}`);
            } else {
                // El alias era de un término sin verificar: es una variante de esta entrada
                const alreadyMerged = mergedSources.has(owner.keywordId);
                mergedSources.add(owner.keywordId);
                if (!dryRun && (!alreadyMerged || alias.exactText)) {
                    await prisma.$transaction(async (tx) => {
                        await mergeKeywordInto(tx, owner.keywordId, keywordId);
                        await tx.keywordAlias.update({
                            where: { aliasText: alias.aliasText },
                            data: { exactText: alias.exactText },
                        });
                    });
                }
            }
        }
    }

    if (!dryRun) {
        await prisma.keywordAlias.createMany({ data: newAliases, skipDuplicates: true });
    }

    console.log(`Alias: ${newAliases.length} nuevos, ${mergedSources.size} términos sin verificar fusionados con su entrada, ` +
        `${exactUpdated} con la regla de escritura exacta actualizada`);
    if (conflicts.length > 0) {
        console.log(`Conflictos (${conflicts.length}), no se modificaron:\n- ${conflicts.join("\n- ")}`);
    }
    await seedRoles(prisma, dryRun);

    console.log(dryRun ? "Simulación terminada: no se escribió nada." : "Listo.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
