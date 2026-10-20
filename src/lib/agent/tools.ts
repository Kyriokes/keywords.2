import "server-only";

import { after } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { prepareCoverLetters } from "@/lib/applications/coverLetterBatch";
import { createApplicationForProfile } from "@/lib/applications/create";
import { WRITING_GUIDE } from "@/lib/applications/voice";
import { runSavedSearch } from "@/lib/ingest/run";
import { getDesiredRolesForProfile, saveDesiredRoles } from "@/lib/positions/save";
import { loadSearchStats } from "@/lib/stats/searchStatsQuery";
import {
    ANSWER_MODES,
    ANSWER_ORIGINS,
    APPLICATION_STATUSES,
    APPLY_MODES,
    LIMITS,
    normalizeLink,
    sanitizeKeywords,
} from "@/lib/validation";
import type { AgentContext } from "./auth";
import { ToolError, defineTool, type McpTool } from "./mcp";

// La descripción completa puede ser larga; al agente le alcanza con el comienzo para completar el formulario
const DESCRIPTION_PREVIEW = 12_000;

export const SERVER_INSTRUCTIONS = `KeyWords guarda las ofertas y postulaciones del usuario.
Flujo: get_candidate y list_answer_templates una vez por sesión; search_now para traer ofertas nuevas; get_queue (status READY) para que el usuario elija en el chat y review_offers con lo que decida; después get_queue (status APPROVED) y para cada oferta get_application.
Reglas: nunca envíes un formulario sin que el usuario lo confirme en el chat; no postules en LinkedIn ni en Indeed; no crees cuentas ni escribas contraseñas.
Al terminar cada oferta llamá a record_result con lo que respondiste: APPLIED si se envió, NEEDS_USER si apareció un login, CAPTCHA o una pregunta que el usuario tiene que responder, SKIPPED si el usuario la descartó.
Cuando el usuario responda una pregunta nueva, guardala con save_answer_template.
Respuestas: las plantillas con mode VERBATIM se copian tal cual; las ADAPT se reescriben para la oferta con el writingGuide de get_candidate. En record_result indicá el origin de cada respuesta.
Para la revisión semanal usá get_search_stats.`;

async function findOwnedApplication(ctx: AgentContext, id: string) {
    const application = await prisma.jobApplication.findFirst({
        where: { id, profileId: ctx.profileId },
    });
    if (!application) throw new ToolError("No existe una oferta con ese id en tu cuenta.");
    return application;
}

const getCandidate = defineTool({
    name: "get_candidate",
    description:
        "Datos del candidato para completar formularios: nombre, email, el CV activo (texto completo), los archivos de CV por idioma (cvFiles: filePath es la ruta local para subirlo, fileUrl el link público), cartas de presentación modelo, archivos reutilizables como el video de presentación y writingGuide, la guía para todo lo que escribas (respuestas adaptadas, respuestas nuevas, cartas).",
    input: z.object({}),
    run: async (ctx: AgentContext) => {
        const [user, activeCv, cvFiles, mediaAssets, coverLetterTemplates] = await Promise.all([
            prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } }),
            prisma.cV.findFirst({
                where: { profileId: ctx.profileId, isPrimary: true },
                select: { id: true, name: true, text: true },
            }),
            // Un archivo por idioma: el agente sube el del idioma de la oferta
            prisma.cV.findMany({
                where: { profileId: ctx.profileId },
                orderBy: { uploadDate: "desc" },
                select: { name: true, isPrimary: true, language: true, fileUrl: true, filePath: true },
            }),
            prisma.mediaAsset.findMany({
                where: { profileId: ctx.profileId },
                select: { id: true, kind: true, name: true, url: true },
                orderBy: { createdAt: "desc" },
            }),
            // Las cartas sin postulación son modelos para adaptar a cada oferta
            prisma.coverLetter.findMany({
                where: { profileId: ctx.profileId, applicationId: null },
                select: { name: true, text: true },
                orderBy: { updatedAt: "desc" },
            }),
        ]);
        return {
            name: user?.name,
            email: user?.email,
            activeCv,
            cvFiles,
            mediaAssets,
            coverLetterTemplates,
            writingGuide: WRITING_GUIDE,
        };
    },
});

const getQueue = defineTool({
    name: "get_queue",
    description:
        "Lista las ofertas de la cola. Por defecto las APPROVED (el usuario ya aprobó postular). applyMode EXTERNAL_FORM es un formulario que podés completar; EASY_APPLY_MANUAL lo envía el usuario.",
    input: z.object({
        status: z.enum(APPLICATION_STATUSES).default("APPROVED"),
        limit: z.number().int().min(1).max(50).default(10),
    }),
    run: async (ctx: AgentContext, input) => {
        const items = await prisma.jobApplication.findMany({
            where: { profileId: ctx.profileId, status: input.status },
            orderBy: [{ score: { sort: "desc", nulls: "last" } }, { date: "asc" }],
            take: input.limit,
            select: {
                id: true,
                jobTitle: true,
                company: true,
                link: true,
                applyUrl: true,
                applyMode: true,
                score: true,
                status: true,
                date: true,
                // Modalidad, seniority, años pedidos y match: lo que hace falta para decidir en el chat
                notes: true,
                source: true,
            },
        });
        return { count: items.length, items };
    },
});

const getApplication = defineTool({
    name: "get_application",
    description:
        "Detalle de una oferta: descripción, link del formulario, carta de presentación preparada, respuestas ya guardadas y la versión de CV adaptada si existe (si no, usá el CV activo de get_candidate).",
    input: z.object({ id: z.string().min(1) }),
    run: async (ctx: AgentContext, input) => {
        await findOwnedApplication(ctx, input.id);
        const application = await prisma.jobApplication.findUniqueOrThrow({
            where: { id: input.id },
            include: {
                coverLetter: { select: { text: true } },
                answers: { select: { question: true, answer: true, templateId: true } },
                cvVariant: { select: { id: true, name: true, text: true, pdfUrl: true } },
            },
        });
        const truncated = application.jobDescription.length > DESCRIPTION_PREVIEW;
        return {
            id: application.id,
            jobTitle: application.jobTitle,
            company: application.company,
            status: application.status,
            link: application.link,
            applyUrl: application.applyUrl ?? application.link,
            applyMode: application.applyMode,
            score: application.score,
            notes: application.notes,
            jobDescription: truncated
                ? `${application.jobDescription.slice(0, DESCRIPTION_PREVIEW)}…`
                : application.jobDescription,
            jobDescriptionTruncated: truncated,
            coverLetter: application.coverLetter?.text ?? null,
            answers: application.answers,
            cvVariant: application.cvVariant,
        };
    },
});

const listAnswerTemplates = defineTool({
    name: "list_answer_templates",
    description:
        "Respuestas tipo del usuario a preguntas frecuentes de los formularios. mode VERBATIM: copiala tal cual (traducila si el formulario está en otro idioma). mode ADAPT: reescribila para la oferta siguiendo writingGuide de get_candidate, sin cambiar los datos; lastAdapted es la última versión adaptada que se envió, para ser coherente. usedCount dice cuántas veces se usó.",
    input: z.object({ query: z.string().trim().max(100).optional() }),
    run: async (ctx: AgentContext, input) => {
        const query = input.query || undefined;
        const templates = await prisma.answerTemplate.findMany({
            where: {
                profileId: ctx.profileId,
                ...(query
                    ? {
                          OR: [
                              { question: { contains: query, mode: "insensitive" } },
                              { answer: { contains: query, mode: "insensitive" } },
                              { tags: { has: query.toLowerCase() } },
                          ],
                      }
                    : {}),
            },
            orderBy: { updatedAt: "desc" },
            take: LIMITS.answerTemplates,
            select: { id: true, question: true, answer: true, tags: true, language: true, mode: true },
        });

        const ids = templates.map((template) => template.id);
        const [uses, adapted] = ids.length
            ? await Promise.all([
                  prisma.applicationAnswer.groupBy({ by: ["templateId"], where: { templateId: { in: ids } }, _count: { _all: true } }),
                  // La última versión adaptada de cada plantilla, para no contradecir lo que ya se envió
                  prisma.applicationAnswer.findMany({
                      where: { templateId: { in: ids }, origin: "ADAPTED" },
                      orderBy: { createdAt: "desc" },
                      distinct: ["templateId"],
                      select: { templateId: true, answer: true },
                  }),
              ])
            : [[], []];
        const usedCount = new Map(uses.map((use) => [use.templateId, use._count._all]));
        const lastAdapted = new Map(adapted.map((answer) => [answer.templateId, answer.answer]));

        return {
            count: templates.length,
            templates: templates.map((template) => ({
                ...template,
                usedCount: usedCount.get(template.id) ?? 0,
                lastAdapted: lastAdapted.get(template.id) ?? null,
            })),
        };
    },
});

const saveAnswerTemplate = defineTool({
    name: "save_answer_template",
    description:
        "Guarda una respuesta tipo que el usuario dio, para reutilizarla. Si ya existe una plantilla con la misma pregunta, la actualiza. mode: VERBATIM si es un dato que se copia tal cual (sueldo, visa, años), ADAPT si es texto libre que se reescribe para cada oferta; sin mode, una nueva queda VERBATIM y una existente conserva el suyo.",
    input: z.object({
        question: z.string().trim().min(1).max(LIMITS.question),
        answer: z.string().trim().min(1).max(LIMITS.answer),
        tags: z.array(z.string()).max(LIMITS.templateTags).optional(),
        language: z.string().trim().max(10).optional(),
        mode: z.enum(ANSWER_MODES).optional(),
    }),
    run: async (ctx: AgentContext, input) => {
        const tags = sanitizeKeywords(input.tags ?? [], LIMITS.templateTags);
        const existing = await prisma.answerTemplate.findFirst({
            where: { profileId: ctx.profileId, question: { equals: input.question, mode: "insensitive" } },
            select: { id: true },
        });
        if (existing) {
            const updated = await prisma.answerTemplate.update({
                where: { id: existing.id },
                data: { answer: input.answer, tags, language: input.language, ...(input.mode ? { mode: input.mode } : {}) },
                select: { id: true },
            });
            return { id: updated.id, updated: true };
        }

        const total = await prisma.answerTemplate.count({ where: { profileId: ctx.profileId } });
        if (total >= LIMITS.answerTemplates) {
            throw new ToolError(`Alcanzaste el máximo de ${LIMITS.answerTemplates} plantillas.`);
        }
        const created = await prisma.answerTemplate.create({
            data: {
                profileId: ctx.profileId,
                question: input.question,
                answer: input.answer,
                tags,
                language: input.language,
                mode: input.mode ?? "VERBATIM",
            },
            select: { id: true },
        });
        return { id: created.id, updated: false };
    },
});

const addOffer = defineTool({
    name: "add_offer",
    description:
        "Carga una oferta en KeyWords. Por defecto queda en la cola (READY) para que el usuario la apruebe. link es la publicación; applyUrl el formulario externo si es otro.",
    input: z.object({
        jobTitle: z.string().trim().min(1).max(LIMITS.title),
        jobDescription: z.string().max(LIMITS.jobDescription),
        link: z.string().max(LIMITS.link).optional(),
        applyUrl: z.string().max(LIMITS.link).optional(),
        company: z.string().max(LIMITS.company).optional(),
        source: z.string().max(LIMITS.source).optional(),
        applyMode: z.enum(APPLY_MODES).optional(),
        status: z.enum(["READY", "APPROVED", "SAVED"]).default("READY"),
        notes: z.string().max(LIMITS.notes).optional(),
    }),
    run: async (ctx: AgentContext, input) => {
        const result = await createApplicationForProfile(ctx.profileId, {
            ...input,
            source: input.source ?? "agent",
            detectedWords: [],
        });
        if (!result.ok) throw new ToolError(result.message);
        const { application } = result.data;
        return { id: application.id, status: application.status, jobTitle: application.jobTitle };
    },
});

const recordResult = defineTool({
    name: "record_result",
    description:
        "Registra el resultado de una postulación: estado final, las preguntas del formulario con lo que se respondió, la carta enviada y, si se adaptó el CV, la versión usada. Reemplaza las respuestas guardadas antes para esa oferta. formUrl es el link del formulario donde se completó, si es distinto del applyUrl (por ejemplo, al seguir el botón de un portal hasta el sitio de la empresa). origin dice de dónde salió cada respuesta: TEMPLATE (plantilla tal cual), ADAPTED (plantilla reescrita), NEW (la dio el usuario en el chat), AGENT (la escribiste desde el CV).",
    input: z.object({
        id: z.string().min(1),
        status: z.enum(["APPLIED", "NEEDS_USER", "SKIPPED"]),
        answers: z
            .array(
                z.object({
                    question: z.string().trim().min(1).max(LIMITS.question),
                    answer: z.string().max(LIMITS.answer),
                    templateId: z.string().optional(),
                    origin: z.enum(ANSWER_ORIGINS).optional(),
                })
            )
            .max(LIMITS.answersPerApplication)
            .optional(),
        coverLetter: z.string().trim().max(LIMITS.coverLetter).optional(),
        cvVariant: z
            .object({
                name: z.string().trim().min(1).max(LIMITS.cvName),
                text: z.string().min(1).max(LIMITS.cvText),
            })
            .optional(),
        notes: z.string().trim().max(LIMITS.notes).optional(),
        formUrl: z
            .string()
            .max(LIMITS.link)
            .transform((value, ctx) => {
                const link = normalizeLink(value);
                if (!link) {
                    ctx.addIssue({ code: "custom", message: "formUrl tiene que ser un link http(s)." });
                    return z.NEVER;
                }
                return link;
            })
            .optional(),
    }),
    run: async (ctx: AgentContext, input) => {
        const application = await findOwnedApplication(ctx, input.id);

        // Una plantilla de otro perfil no se vincula: la respuesta se guarda igual, sin referencia
        const requestedTemplates = Array.from(
            new Set((input.answers ?? []).flatMap((answer) => (answer.templateId ? [answer.templateId] : [])))
        );
        const ownedTemplates = new Set(
            requestedTemplates.length
                ? (
                      await prisma.answerTemplate.findMany({
                          where: { id: { in: requestedTemplates }, profileId: ctx.profileId },
                          select: { id: true },
                      })
                  ).map((template) => template.id)
                : []
        );

        await prisma.$transaction(async (tx) => {
            const variant = input.cvVariant
                ? await tx.cvVariant.create({
                      data: {
                          profileId: ctx.profileId,
                          name: input.cvVariant.name,
                          text: input.cvVariant.text,
                          baseCvId: application.cvId,
                      },
                      select: { id: true },
                  })
                : null;

            await tx.jobApplication.update({
                where: { id: application.id },
                data: {
                    status: input.status,
                    ...(input.status === "APPLIED" ? { appliedAt: new Date() } : {}),
                    ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
                    // El formulario real permite sugerir seguir a esa empresa en su ATS
                    ...(input.formUrl ? { applyUrl: input.formUrl } : {}),
                    ...(variant ? { cvVariantId: variant.id } : {}),
                },
            });

            if (input.answers) {
                await tx.applicationAnswer.deleteMany({ where: { applicationId: application.id } });
                await tx.applicationAnswer.createMany({
                    data: input.answers.map((answer) => ({
                        applicationId: application.id,
                        question: answer.question,
                        answer: answer.answer,
                        templateId: answer.templateId && ownedTemplates.has(answer.templateId) ? answer.templateId : null,
                        origin: answer.origin ?? null,
                    })),
                });
            }

            if (input.coverLetter) {
                await tx.coverLetter.upsert({
                    where: { applicationId: application.id },
                    create: { profileId: ctx.profileId, applicationId: application.id, text: input.coverLetter },
                    update: { text: input.coverLetter },
                });
            }
        });

        return { id: application.id, status: input.status, answersSaved: input.answers?.length ?? 0 };
    },
});

const getDesiredPositions = defineTool({
    name: "get_desired_positions",
    description:
        "Puestos deseados del usuario (los que usa la búsqueda diaria de ofertas) y la lista de roles del diccionario que se pueden elegir.",
    input: z.object({}),
    run: async (ctx: AgentContext) => {
        const { selected, available } = await getDesiredRolesForProfile(ctx.profileId);
        return { selected, available };
    },
});

const setDesiredPositions = defineTool({
    name: "set_desired_positions",
    description: `Reemplaza los puestos deseados del usuario (máximo ${LIMITS.positions}). Usá nombres de get_desired_positions; los que no sean roles del diccionario se descartan y se devuelven en notRecognized. Confirmá la lista con el usuario antes de guardarla.`,
    input: z.object({ titles: z.array(z.string().trim().min(1).max(LIMITS.title)).min(1).max(LIMITS.positions) }),
    run: async (ctx: AgentContext, input) => {
        const result = await saveDesiredRoles(ctx.profileId, input.titles);
        if (!result.ok) throw new ToolError(result.message);
        return { saved: result.data.roles, notRecognized: result.data.dropped };
    },
});

const reviewOffers = defineTool({
    name: "review_offers",
    description:
        "Aprueba o descarta ofertas de la cola según lo que el usuario decidió en el chat (por ejemplo \"aprobá 1, 3 y 5-9\"). Solo cambia ofertas READY, APPROVED o NEEDS_USER. Al aprobar, KeyWords prepara la carta de presentación en segundo plano.",
    input: z.object({
        approve: z.array(z.string().min(1)).max(50).default([]),
        skip: z.array(z.string().min(1)).max(50).default([]),
    }),
    run: async (ctx: AgentContext, input) => {
        const skip = input.skip.filter((id) => !input.approve.includes(id));
        const requested = [...input.approve, ...skip];
        if (requested.length === 0) throw new ToolError("Indicá al menos una oferta para aprobar o descartar.");

        const found = await prisma.jobApplication.findMany({
            where: { id: { in: requested }, profileId: ctx.profileId, status: { in: ["READY", "APPROVED", "NEEDS_USER"] } },
            select: { id: true, status: true },
        });
        const statusById = new Map(found.map((app) => [app.id, app.status]));
        const toApprove = input.approve.filter((id) => statusById.has(id));
        const toSkip = skip.filter((id) => statusById.has(id));

        if (toApprove.length) {
            await prisma.jobApplication.updateMany({ where: { id: { in: toApprove }, profileId: ctx.profileId }, data: { status: "APPROVED" } });
        }
        if (toSkip.length) {
            await prisma.jobApplication.updateMany({ where: { id: { in: toSkip }, profileId: ctx.profileId }, data: { status: "SKIPPED" } });
        }

        // Igual que al aprobar desde la app: la carta se prepara sin hacer esperar la respuesta
        const newlyApproved = toApprove.filter((id) => statusById.get(id) !== "APPROVED");
        if (newlyApproved.length) after(() => prepareCoverLetters(ctx.profileId, newlyApproved).then(() => undefined));

        return {
            approved: toApprove.length,
            skipped: toSkip.length,
            notFound: requested.filter((id) => !statusById.has(id)),
        };
    },
});

const searchNow = defineTool({
    name: "search_now",
    description:
        "Busca ofertas nuevas en los portales con la configuración guardada del usuario y deja en la cola (READY) las que pasan los filtros. Como mucho una vez por hora; llamala al empezar una sesión de postulaciones, antes de get_queue.",
    input: z.object({}),
    run: async (ctx: AgentContext) => {
        const result = await runSavedSearch(ctx.profileId, "AGENT");
        if (!result.ok) throw new ToolError(result.message);
        return result.data;
    },
});

const getSearchStats = defineTool({
    name: "get_search_stats",
    description:
        "Qué rindió la búsqueda en los últimos días: ofertas por portal, embudo hasta entrevistas, motivos de descarte, empresas y roles que más publican, últimas búsquedas y cómo se respondieron los formularios. Para la revisión semanal.",
    input: z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }),
    run: (ctx: AgentContext, input) => loadSearchStats(ctx.profileId, input.days),
});

export const agentTools: McpTool<AgentContext>[] = [
    getCandidate,
    getQueue,
    getApplication,
    listAnswerTemplates,
    saveAnswerTemplate,
    addOffer,
    recordResult,
    getDesiredPositions,
    setDesiredPositions,
    searchNow,
    reviewOffers,
    getSearchStats,
];
