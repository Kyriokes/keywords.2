// Estandariza los datos guardados antes del diccionario. Correr después de `dictionary:seed`.
//
//   pnpm dictionary:backfill           simulación: informa qué haría, no escribe
//   pnpm dictionary:backfill --apply   aplica los cambios
//
// Pasos:
//   1. CVs con texto: sus keywords se recalculan con el diccionario (dejan de ser una bolsa de palabras).
//   2. Keywords sin verificar que quedaron sin ningún vínculo: se borran.
//   3. Keywords de postulaciones sin alias: se fusionan con la entrada que tiene su clave,
//      o se les crea el alias para que las próximas variantes caigan en la misma.
import { PrismaClient } from "@prisma/client";
import { matchText, type AliasIndex } from "../../src/lib/keywords/core";
import { mergeKeywordInto } from "../../src/lib/keywords/merge";
import { planKeywordBackfill } from "./backfill-plan";
import { describeTarget } from "./target";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

const nameOf = (keyword: { displayName: string | null; canonicalText: string }) =>
    keyword.displayName || keyword.canonicalText;

async function main() {
    console.log(`Base: ${describeTarget()} | ${apply ? "APLICANDO CAMBIOS" : "SIMULACIÓN (no escribe; usar --apply para aplicar)"}`);

    // ── 1. Keywords de los CVs ──────────────────────────────────────────────
    const dictionaryAliases = await prisma.keywordAlias.findMany({
        where: { keyword: { isApproved: true, isBlocked: false } },
        select: { aliasText: true, exactText: true, keywordId: true },
    });
    if (dictionaryAliases.length === 0) {
        console.error("El diccionario está vacío. Corré primero: pnpm dictionary:seed");
        process.exitCode = 1;
        return;
    }
    const index: AliasIndex = new Map(
        dictionaryAliases.map((alias) => [alias.aliasText, { keywordId: alias.keywordId, exactText: alias.exactText }])
    );

    const cvs = await prisma.cV.findMany({
        select: { id: true, text: true, _count: { select: { keywords: true } } },
    });
    const withText = cvs.filter((cv) => cv.text.trim());

    let linksBefore = 0;
    let linksAfter = 0;
    for (const cv of withText) {
        const keywordIds = Array.from(matchText(cv.text, index).keys());
        linksBefore += cv._count.keywords;
        linksAfter += keywordIds.length;

        if (apply) {
            await prisma.$transaction([
                prisma.cVKeyword.deleteMany({ where: { cvId: cv.id } }),
                prisma.cVKeyword.createMany({
                    data: keywordIds.map((keywordId) => ({ cvId: cv.id, keywordId })),
                    skipDuplicates: true,
                }),
            ]);
        }
    }
    console.log(`1. CVs: ${withText.length} con texto (de ${cvs.length}). ` +
        `Sus vínculos con keywords pasan de ${linksBefore} a ${linksAfter}.`);

    // ── 2. Keywords huérfanas ───────────────────────────────────────────────
    if (apply) {
        const { count } = await prisma.keyword.deleteMany({
            where: { isApproved: false, jobApplications: { none: {} }, cvs: { none: {} } },
        });
        console.log(`2. Huérfanas: se borraron ${count} keywords sin verificar que ya no usaba nadie.`);
    } else {
        // En simulación los CVs no se recalcularon: cuentan las que hoy solo usan CVs con texto
        const estimate = await prisma.keyword.count({
            where: {
                isApproved: false,
                jobApplications: { none: {} },
                cvs: { every: { cvId: { in: withText.map((cv) => cv.id) } } },
            },
        });
        console.log(`2. Huérfanas: se borrarían ${estimate} keywords sin verificar que no pide ninguna postulación.`);
    }

    // ── 3. Keywords de postulaciones sin alias ──────────────────────────────
    const keywords = await prisma.keyword.findMany({
        // Las que solo usa algún CV sin texto no se tocan
        where: { OR: [{ isApproved: true }, { aliases: { some: {} } }, { jobApplications: { some: {} } }] },
        select: {
            id: true,
            displayName: true,
            canonicalText: true,
            isApproved: true,
            aliases: { select: { aliasText: true } },
        },
    });
    const approvedIds = new Set(keywords.filter((keyword) => keyword.isApproved).map((keyword) => keyword.id));

    const steps = planKeywordBackfill(keywords.map((keyword) => ({
        id: keyword.id,
        name: nameOf(keyword),
        isApproved: keyword.isApproved,
        aliasKeys: keyword.aliases.map((alias) => alias.aliasText),
    })));
    const aliasSteps = steps.flatMap((step) => (step.type === "alias" ? [step] : []));
    const mergeSteps = steps.flatMap((step) => (step.type === "merge" ? [step] : []));
    const intoDictionary = mergeSteps.filter((step) => approvedIds.has(step.targetId)).length;

    console.log(`3. Keywords de postulaciones: ${intoDictionary} variantes se fusionan con una entrada del diccionario, ` +
        `${mergeSteps.length - intoDictionary} con otra variante sin verificar y ${aliasSteps.length} reciben su alias.`);

    if (apply) {
        await prisma.keywordAlias.createMany({
            data: aliasSteps.map((step) => ({ aliasText: step.aliasText, keywordId: step.keywordId })),
            skipDuplicates: true,
        });
        for (const step of mergeSteps) {
            await prisma.$transaction((tx) => mergeKeywordInto(tx, step.sourceId, step.targetId));
        }
    }

    // ── Candidatas a sumar al diccionario ───────────────────────────────────
    const pending = await prisma.keyword.findMany({
        where: { isApproved: false, isBlocked: false, jobApplications: { some: {} } },
        select: { displayName: true, canonicalText: true, _count: { select: { jobApplications: true } } },
        orderBy: { jobApplications: { _count: "desc" } },
        take: 50,
    });
    console.log(`\nSin verificar más pedidas${apply ? "" : " (antes de fusionar)"}: candidatas a aprobar en /admin o sumar a tech.json`);
    for (const keyword of pending) {
        console.log(`  ${String(keyword._count.jobApplications).padStart(4)}  ${nameOf(keyword)}`);
    }

    console.log(apply ? "\nListo." : "\nSimulación terminada: no se escribió nada.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
