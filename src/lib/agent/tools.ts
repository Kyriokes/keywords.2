import "server-only";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { applyModeForUrl } from "@/lib/applications/applyMode";
import { latestAdaptedByTemplate } from "@/lib/applications/answers";
import { generateCoverLetterForApplication } from "@/lib/applications/coverLetter";
import { createApplicationForProfile } from "@/lib/applications/create";
import { appendNote } from "@/lib/applications/notes";
import { skipApplications } from "@/lib/applications/skip";
import { SKIP_REASONS } from "@/lib/applications/skipReasons";
import { WRITING_GUIDE } from "@/lib/applications/voice";
import { runSavedSearch } from "@/lib/ingest/run";
import { loadSearchSettings, updateSearchRules } from "@/lib/ingest/settings";
import { deletePreference, listPreferences, savePreference } from "@/lib/preferences/preferences";
import { getDesiredRolesForProfile, saveDesiredRoles } from "@/lib/positions/save";
import { loadSearchStats } from "@/lib/stats/searchStatsQuery";
import {
    ANSWER_MODES,
    ANSWER_ORIGINS,
    APPLICATION_STATUSES,
    APPLY_MODES,
    LIMITS,
    normalizeLink,
    preferenceSchema,
    sanitizeKeywords,
    searchRulesSchema,
} from "@/lib/validation";
import type { AgentContext } from "./auth";
import { ToolError, defineTool, type McpTool } from "./mcp";

// La descripción completa puede ser larga; al agente le alcanza con el comienzo para completar el formulario
const DESCRIPTION_PREVIEW = 12_000;

/** Sube cuando cambian las herramientas: la skill lo compara para avisar que hay que reconectar el MCP. */
export const SERVER_VERSION = "0.2.0";

/** Estados desde los que el usuario puede aprobar o descartar una oferta. */
const REVIEWABLE_STATUSES = ["READY", "APPROVED", "NEEDS_USER"] as const;

/** Respuestas adaptadas que se miran para encontrar la última de cada plantilla. */
const ADAPTED_SAMPLE = 200;

export const SERVER_INSTRUCTIONS = `KeyWords guarda las ofertas y postulaciones del usuario, y sus criterios de búsqueda.
Flujo: get_candidate, list_answer_templates y get_preferences una vez por sesión (las reglas y preferencias son del usuario: no se las preguntes); search_now para traer ofertas nuevas; get_queue (status READY) para que el usuario elija en el chat y review_offers con lo que decida; después get_queue (status APPROVED, applyMode EXTERNAL_FORM) y para cada oferta get_application.
Descartes: si el usuario dice por qué descarta ("es PHP", "piden alemán", "otra vez esa empresa"), mandá reason y detail en review_offers o record_result. KeyWords aprende de los descartes por tecnología y por empresa (learned) y deja de traer esas ofertas; contáselo al usuario en una línea. Si el usuario dice una preferencia o una regla en el chat, guardala con save_preference o set_search_rules después de confirmarla.
Reglas: nunca envíes un formulario sin que el usuario lo confirme en el chat; no postules en LinkedIn ni en Indeed; no crees cuentas ni escribas contraseñas.
Carta: pedila con prepare_cover_letter solo si el formulario tiene campo de carta o de mensaje.
Al terminar cada oferta llamá a record_result con lo que respondiste: APPLIED si se envió, NEEDS_USER si apareció un login, CAPTCHA o una pregunta que el usuario tiene que responder, SKIPPED si el usuario la descartó.
Cuando el usuario responda una pregunta nueva, guardala con save_answer_template.
Respuestas: las plantillas con mode VERBATIM se copian tal cual; las ADAPT se reescriben para la oferta con el writingGuide de get_candidate. En record_result indicá el origin de cada respuesta; elegir la opción de un desplegable según la plantilla cuenta como TEMPLATE.
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
            serverVersion: SERVER_VERSION,
        };
    },
});

const getQueue = defineTool({
    name: "get_queue",
    description:
        "Lista las ofertas de la cola. Por defecto las APPROVED (el usuario ya aprobó postular). applyMode filtra: EXTERNAL_FORM son formularios que podés completar (usalo para la tanda de postulaciones); UNSUPPORTED y EASY_APPLY_MANUAL las envía el usuario (listalas en el cierre).",
    input: z.object({
        status: z.enum(APPLICATION_STATUSES).default("APPROVED"),
        applyMode: z.enum(APPLY_MODES).optional(),
        limit: z.number().int().min(1).max(50).default(10),
    }),
    run: async (ctx: AgentContext, input) => {
        const items = await prisma.jobApplication.findMany({
            where: { profileId: ctx.profileId, status: input.status, ...(input.applyMode ? { applyMode: input.applyMode } : {}) },
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
                  // La última versión adaptada de cada plantilla, para no contradecir lo que ya se envió.
                  // Se saltean las que son solo una opción elegida de una lista ("Yes", "Other").
                  prisma.applicationAnswer.findMany({
                      where: { templateId: { in: ids }, origin: "ADAPTED" },
                      orderBy: { createdAt: "desc" },
                      take: ADAPTED_SAMPLE,
                      select: { templateId: true, answer: true },
                  }),
              ])
            : [[], []];
        const usedCount = new Map(uses.map((use) => [use.templateId, use._count._all]));
        const lastAdapted = latestAdaptedByTemplate(adapted);

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
        "Carga una oferta en KeyWords. Por defecto queda en la cola (READY) para que el usuario la apruebe. link es la publicación; applyUrl el formulario externo si es otro. Si el formulario está en un portal que pide cuenta o no se puede automatizar (Workday, Computrabajo, Bumeran, LinkedIn, Indeed, EmpleosIT, JobLeads), queda UNSUPPORTED aunque mandes otro applyMode.",
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
        // El dominio del formulario manda: así Indeed o Computrabajo no entran como formularios de Claude
        const formUrl = input.applyUrl?.trim() || input.link?.trim();
        const hostMode = formUrl ? applyModeForUrl(formUrl) : null;
        const applyMode = hostMode === "UNSUPPORTED" ? "UNSUPPORTED" : input.applyMode ?? "EXTERNAL_FORM";
        const result = await createApplicationForProfile(ctx.profileId, {
            ...input,
            applyMode,
            source: input.source ?? "agent",
            detectedWords: [],
        });
        if (!result.ok) throw new ToolError(result.message);
        const { application } = result.data;
        return { id: application.id, status: application.status, applyMode: application.applyMode, jobTitle: application.jobTitle };
    },
});

const recordResult = defineTool({
    name: "record_result",
    description:
        "Registra el resultado de una postulación: estado final, las preguntas del formulario con lo que se respondió, la carta enviada y, si se adaptó el CV, la versión usada. Reemplaza las respuestas guardadas antes para esa oferta; las notas se suman a las que ya tenía. formUrl es el link del formulario donde se completó, si es distinto del applyUrl (por ejemplo, al seguir el botón de un portal hasta el sitio de la empresa). origin dice de dónde salió cada respuesta: TEMPLATE (plantilla tal cual o una opción elegida según ella), ADAPTED (plantilla reescrita), NEW (la dio el usuario en el chat), AGENT (la escribiste desde el CV). Con SKIPPED, reason y detail dicen por qué (TECH + 'Go', LANGUAGE + 'alemán', COMPANY…): KeyWords aprende de los descartes por tecnología y empresa.",
    input: z.object({
        id: z.string().min(1),
        status: z.enum(["APPLIED", "NEEDS_USER", "SKIPPED"]),
        reason: z.enum(SKIP_REASONS).optional(),
        detail: z.string().trim().max(LIMITS.skipDetail).optional(),
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
                    // El resumen del ingreso se conserva; lo que pasó al postular va debajo
                    ...(input.notes ? { notes: appendNote(application.notes, input.notes) } : {}),
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

        // Un descarte guarda su motivo y, si fue por tecnología o empresa, KeyWords lo aprende
        const { learned } =
            input.status === "SKIPPED"
                ? await skipApplications(ctx.profileId, [{ id: application.id, reason: input.reason, detail: input.detail }], ["SKIPPED"])
                : { learned: [] };

        return { id: application.id, status: input.status, answersSaved: input.answers?.length ?? 0, learned };
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

// Un descarte puede ser solo el id (como antes) o el id con su motivo
const skipItemSchema = z.union([
    z.string().min(1),
    z.object({
        id: z.string().min(1),
        reason: z.enum(SKIP_REASONS).optional(),
        detail: z.string().trim().max(LIMITS.skipDetail).optional(),
    }),
]);

const reviewOffers = defineTool({
    name: "review_offers",
    description:
        "Aprueba o descarta ofertas de la cola según lo que el usuario decidió en el chat (por ejemplo \"aprobá 1, 3 y 5-9\"). Solo cambia ofertas READY, APPROVED o NEEDS_USER. En skip podés mandar el id solo o { id, reason, detail } cuando el usuario dijo por qué (TECH + 'PHP', LANGUAGE + 'alemán', COMPANY, LOCATION, NOT_A_JOB, SENIORITY, SALARY, DUPLICATE, CLOSED, OTHER). Los descartes por tecnología y por empresa quedan como preferencia (learned) y la búsqueda deja de traer esas ofertas: contáselo al usuario.",
    input: z.object({
        approve: z.array(z.string().min(1)).max(50).default([]),
        skip: z.array(skipItemSchema).max(50).default([]),
    }),
    run: async (ctx: AgentContext, input) => {
        const skips = input.skip
            .map((item) => (typeof item === "string" ? { id: item } : item))
            .filter((item) => !input.approve.includes(item.id));
        const requested = [...input.approve, ...skips.map((item) => item.id)];
        if (requested.length === 0) throw new ToolError("Indicá al menos una oferta para aprobar o descartar.");

        const found = await prisma.jobApplication.findMany({
            where: { id: { in: requested }, profileId: ctx.profileId, status: { in: [...REVIEWABLE_STATUSES] } },
            select: { id: true, status: true },
        });
        const statusById = new Map(found.map((app) => [app.id, app.status]));
        const toApprove = input.approve.filter((id) => statusById.has(id));
        const toSkip = skips.filter((item) => statusById.has(item.id));

        if (toApprove.length) {
            await prisma.jobApplication.updateMany({ where: { id: { in: toApprove }, profileId: ctx.profileId }, data: { status: "APPROVED" } });
        }
        const { skipped, learned } = toSkip.length
            ? await skipApplications(ctx.profileId, toSkip, REVIEWABLE_STATUSES)
            : { skipped: [], learned: [] };

        return {
            approved: toApprove.length,
            skipped: skipped.length,
            learned,
            notFound: requested.filter((id) => !statusById.has(id)),
        };
    },
});

const getPreferences = defineTool({
    name: "get_preferences",
    description:
        "Reglas de la búsqueda del usuario (modalidades, nivel, match mínimo, auto-aprobación, sueldo mínimo en USD y en ARS, tope de postulaciones por empresa) y sus preferencias: tecnologías y empresas a evitar y frases que descartan una oferta, cargadas por él o aprendidas de sus descartes (origin LEARNED). Leelas al empezar la sesión: son sus criterios, no se los preguntes.",
    input: z.object({}),
    run: async (ctx: AgentContext) => {
        const [settings, preferences] = await Promise.all([loadSearchSettings(ctx.profileId), listPreferences(ctx.profileId)]);
        return {
            rules: {
                workModes: settings.workModes,
                seniorityPolicy: settings.seniorityPolicy,
                minScore: settings.minScore,
                minRelocationSalaryUsd: settings.minRelocationSalaryUsd,
                autoApproveMinScore: settings.autoApproveMinScore,
                minSalaryUsdMonthly: settings.minSalaryUsdMonthly,
                minSalaryArsMonthly: settings.minSalaryArsMonthly,
                maxPerCompanyPerMonth: settings.maxPerCompanyPerMonth,
            },
            preferences,
        };
    },
});

const savePreferenceTool = defineTool({
    name: "save_preference",
    description:
        "Guarda algo que el usuario no quiere: AVOID_TECH (una tecnología, como 'PHP'), AVOID_COMPANY (una empresa) o AVOID_PHRASE (una frase que, si aparece en la oferta, la descarta, como 'talent pool'). La búsqueda deja de traer esas ofertas. Confirmá con el usuario antes de guardar.",
    input: preferenceSchema,
    run: async (ctx: AgentContext, input) => {
        const result = await savePreference(ctx.profileId, { ...input, origin: "USER" });
        if (!result.ok) throw new ToolError(result.message);
        return result.data;
    },
});

const deletePreferenceTool = defineTool({
    name: "delete_preference",
    description: "Borra una preferencia (id de get_preferences), por ejemplo cuando KeyWords aprendió algo que el usuario no quería.",
    input: z.object({ id: z.string().min(1) }),
    run: async (ctx: AgentContext, input) => {
        const deleted = await deletePreference(ctx.profileId, input.id);
        if (!deleted) throw new ToolError("No existe una preferencia con ese id en tu cuenta.");
        return { deleted: true };
    },
});

const setSearchRules = defineTool({
    name: "set_search_rules",
    description:
        "Cambia reglas de la búsqueda: autoApproveMinScore (match desde el que una oferta sin advertencias y con formulario externo entra aprobada sin pasar por la cola; null = nunca), minSalaryUsdMonthly (una oferta que publica menos se descarta; null = no mirar el sueldo), minSalaryArsMonthly (referencia para ofertas locales) y maxPerCompanyPerMonth (postulaciones a la misma empresa en 30 días). Solo se guarda lo que viene. Confirmá los valores con el usuario antes.",
    input: searchRulesSchema,
    run: async (ctx: AgentContext, input) => {
        if (Object.values(input).every((value) => value === undefined)) throw new ToolError("Indicá al menos una regla para cambiar.");
        return updateSearchRules(ctx.profileId, input);
    },
});

const prepareCoverLetter = defineTool({
    name: "prepare_cover_letter",
    description:
        "Genera con la IA de KeyWords la carta de presentación de una oferta (en el idioma de la oferta, con los datos del CV) y la deja guardada. Llamala solo cuando el formulario tiene un campo de carta o de mensaje. Si la oferta ya tiene carta, la devuelve sin regenerar.",
    input: z.object({ id: z.string().min(1) }),
    run: async (ctx: AgentContext, input) => {
        await findOwnedApplication(ctx, input.id);
        const existing = await prisma.coverLetter.findUnique({ where: { applicationId: input.id }, select: { text: true } });
        if (existing) return { text: existing.text, generated: false };
        const result = await generateCoverLetterForApplication(ctx.profileId, input.id);
        if (!result.ok) throw new ToolError(result.message);
        return { text: result.data.text, generated: true };
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
    getPreferences,
    savePreferenceTool,
    deletePreferenceTool,
    setSearchRules,
    prepareCoverLetter,
];
