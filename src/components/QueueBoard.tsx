'use client'

import { useState } from 'react'
import { Check, CheckCheck, ExternalLink, Loader2, PhoneCall, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { updateApplicationStatus } from '@/actions/application-actions'
import {
    approveQueueByScore,
    generateApplicationCoverLetter,
    saveApplicationCoverLetter,
    skipApplication,
    type QueueData,
    type QueueItem,
} from '@/actions/queue-actions'
import { SKIP_REASONS, SKIP_REASON_LABELS, isSkipReason, type SkipReason } from '@/lib/applications/skipReasons'
import { LEARNED_LABELS } from '@/lib/preferences/kinds'
import type { ApplicationStatusValue } from '@/lib/validation'

const APPLY_MODE_LABELS: Record<string, string> = {
    EXTERNAL_FORM: 'La completa Claude',
    EASY_APPLY_MANUAL: 'Easy Apply: la enviás vos',
    UNSUPPORTED: 'Manual',
}

const dateTimeFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

interface StatusAction {
    status: ApplicationStatusValue
    label: string
    icon: typeof Check
    variant?: 'default' | 'outline' | 'ghost'
}

const ACTIONS: Record<string, StatusAction[]> = {
    READY: [
        { status: 'APPROVED', label: 'Aprobar', icon: Check },
        { status: 'SKIPPED', label: 'Descartar', icon: X, variant: 'ghost' },
    ],
    APPROVED: [
        { status: 'READY', label: 'Volver a la cola', icon: RotateCcw, variant: 'outline' },
        { status: 'SKIPPED', label: 'Descartar', icon: X, variant: 'ghost' },
    ],
    NEEDS_USER: [
        { status: 'APPLIED', label: 'Ya la envié yo', icon: Send },
        { status: 'APPROVED', label: 'Reintentar con Claude', icon: RotateCcw, variant: 'outline' },
        { status: 'SKIPPED', label: 'Descartar', icon: X, variant: 'ghost' },
    ],
    // Lo que respondió la empresa: sin esto las estadísticas no saben qué portal termina en entrevista
    APPLIED: [
        { status: 'INTERVIEW', label: 'Me llamaron a entrevista', icon: PhoneCall },
        { status: 'REJECTED', label: 'Me rechazaron', icon: X, variant: 'ghost' },
    ],
    INTERVIEW: [{ status: 'REJECTED', label: 'Me rechazaron', icon: X, variant: 'ghost' }],
}

type QueueCardVariant = 'pending' | 'submitted'
type OnStatus = (item: QueueItem, status: ApplicationStatusValue) => void
type OnSkip = (item: QueueItem, reason: SkipReason | undefined, detail: string | undefined) => Promise<void>

/** Descartar pide el motivo: con eso KeyWords aprende qué no traer más. */
function SkipForm({ onSkip, onCancel }: { onSkip: (reason: SkipReason | undefined, detail: string | undefined) => Promise<void>; onCancel: () => void }) {
    const [reason, setReason] = useState<SkipReason | ''>('')
    const [detail, setDetail] = useState('')
    const [busy, setBusy] = useState(false)

    const submit = async () => {
        setBusy(true)
        try {
            await onSkip(reason || undefined, detail.trim() || undefined)
        } finally {
            setBusy(false)
        }
    }

    const detailPlaceholder = reason === 'TECH' ? 'Qué tecnología (Go, PHP, Java…)' : reason === 'COMPANY' ? 'Empresa (si no es la de la oferta)' : reason === 'LANGUAGE' ? 'Qué idioma (alemán, portugués…)' : 'Detalle (opcional)'

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
            <Select value={reason} onValueChange={(value) => setReason(isSkipReason(value) ? value : '')}>
                <SelectTrigger className="w-[220px]" aria-label="Motivo del descarte">
                    <SelectValue placeholder="¿Por qué? (opcional)" />
                </SelectTrigger>
                <SelectContent>
                    {SKIP_REASONS.map((value) => (
                        <SelectItem key={value} value={value}>
                            {SKIP_REASON_LABELS[value]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={detailPlaceholder} className="w-60" maxLength={200} />
            <Button size="sm" variant="ghost" onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                Descartar
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
                Cancelar
            </Button>
            {(reason === 'TECH' || reason === 'COMPANY') && (
                <p className="basis-full text-xs text-muted-foreground">KeyWords va a dejar de traer ofertas así.</p>
            )}
        </div>
    )
}

/** Estados que tienen botones en cada pestaña: las enviadas solo marcan la respuesta de la empresa. */
const STATUSES_WITH_ACTIONS: Record<QueueCardVariant, string[]> = {
    pending: ['READY', 'APPROVED', 'NEEDS_USER'],
    submitted: ['APPLIED', 'INTERVIEW'],
}

const RESULT_BADGES: Record<string, string> = { INTERVIEW: 'Entrevista', REJECTED: 'Rechazada' }

/** Carta de una oferta pendiente: la que Claude va a usar. Se puede generar con la IA y editar. */
function CoverLetterEditor({ item }: { item: QueueItem }) {
    const [saved, setSaved] = useState(item.coverLetter ?? '')
    const [text, setText] = useState(saved)
    const [busy, setBusy] = useState<'save' | 'generate' | null>(null)

    const generate = async () => {
        if (saved && !window.confirm('¿Reemplazar la carta actual por una nueva?')) return
        setBusy('generate')
        try {
            const result = await generateApplicationCoverLetter(item.id)
            if (!result.ok) return void toast.error(result.message)
            setSaved(result.data.text)
            setText(result.data.text)
        } catch {
            toast.error('No se pudo generar la carta')
        } finally {
            setBusy(null)
        }
    }

    const save = async () => {
        setBusy('save')
        try {
            const result = await saveApplicationCoverLetter(item.id, text)
            if (!result.ok) return void toast.error(result.message)
            setSaved(text.trim())
            toast.success('Carta guardada')
        } catch {
            toast.error('No se pudo guardar la carta')
        } finally {
            setBusy(null)
        }
    }

    return (
        <details className="text-sm">
            <summary className="cursor-pointer font-medium">
                Carta de presentación {saved ? '' : '(sin generar)'}
            </summary>
            <div className="mt-3 space-y-2">
                {saved || text ? (
                    <Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-48" />
                ) : (
                    <p className="text-muted-foreground">
                        Todavía no hay carta. Claude la genera solo si el formulario tiene campo de carta; también podés generarla ahora.
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    {text.trim() !== saved && text.trim() && (
                        <Button size="sm" onClick={save} disabled={busy !== null}>
                            {busy === 'save' && <Loader2 className="size-4 animate-spin" />}
                            Guardar carta
                        </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={generate} disabled={busy !== null}>
                        {busy === 'generate' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        {saved ? 'Regenerar con IA' : 'Generar con IA'}
                    </Button>
                </div>
            </div>
        </details>
    )
}

function QueueCard({ item, variant, onStatus, onSkip }: { item: QueueItem; variant: QueueCardVariant; onStatus: OnStatus; onSkip?: OnSkip }) {
    const [skipping, setSkipping] = useState(false)
    const formUrl = item.applyUrl ?? item.link
    // En las pendientes la carta se edita aparte; en las enviadas es parte de lo que se envió
    const isPending = variant === 'pending'
    const hasRecord = item.answers.length > 0 || !!item.cvVariantName || (!isPending && !!item.coverLetter)
    const actions = STATUSES_WITH_ACTIONS[variant].includes(item.status) ? ACTIONS[item.status] : undefined

    const act = (action: StatusAction) => {
        // Descartar pregunta el motivo antes; el resto cambia el estado directo
        if (action.status === 'SKIPPED' && onSkip) return setSkipping(true)
        onStatus(item, action.status)
    }

    return (
        <li className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                    <p className="font-medium">{item.jobTitle}</p>
                    <p className="text-sm text-muted-foreground">
                        {item.company ?? 'Empresa sin cargar'} ·{' '}
                        {item.appliedAt ? `enviada ${dateTimeFormatter.format(new Date(item.appliedAt))}` : `cargada ${item.date}`}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!isPending && RESULT_BADGES[item.status] && <Badge>{RESULT_BADGES[item.status]}</Badge>}
                    {item.score !== null && <Badge variant="secondary">Match {item.score}%</Badge>}
                    {item.applyMode && <Badge variant="outline">{APPLY_MODE_LABELS[item.applyMode] ?? item.applyMode}</Badge>}
                </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
                {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        Publicación <ExternalLink className="size-3" />
                    </a>
                )}
                {formUrl && formUrl !== item.link && (
                    <a href={formUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        Formulario <ExternalLink className="size-3" />
                    </a>
                )}
            </div>

            {item.notes && <p className="rounded-md bg-muted px-3 py-2 text-sm">{item.notes}</p>}

            {hasRecord && (
                <details className="text-sm">
                    <summary className="cursor-pointer font-medium">Qué se envió</summary>
                    <div className="mt-3 space-y-4">
                        {item.cvVariantName && (
                            <p>
                                <span className="text-muted-foreground">CV usado:</span> {item.cvVariantName}
                            </p>
                        )}
                        {item.answers.length > 0 && (
                            <dl className="space-y-2">
                                {item.answers.map((answer, index) => (
                                    <div key={index}>
                                        <dt className="text-muted-foreground">{answer.question}</dt>
                                        <dd className="whitespace-pre-wrap">{answer.answer}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                        {item.coverLetter && !isPending && (
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Carta de presentación</p>
                                <p className="whitespace-pre-wrap rounded-md border p-3">{item.coverLetter}</p>
                            </div>
                        )}
                    </div>
                </details>
            )}

            {isPending && <CoverLetterEditor item={item} />}

            {skipping && onSkip ? (
                <SkipForm onSkip={(reason, detail) => onSkip(item, reason, detail)} onCancel={() => setSkipping(false)} />
            ) : (
                actions && (
                    <div className="flex flex-wrap gap-2">
                        {actions.map((action) => (
                            <Button key={action.status} size="sm" variant={action.variant ?? 'default'} onClick={() => act(action)}>
                                <action.icon className="size-4" />
                                {action.label}
                            </Button>
                        ))}
                    </div>
                )
            )}
        </li>
    )
}

const DEFAULT_BULK_SCORE = 50

/** Aprueba de una vez las ofertas por aprobar con match igual o mayor al elegido. */
function BulkApprove({ ready, onApproved }: { ready: QueueItem[]; onApproved: (minScore: number) => void }) {
    const [minScore, setMinScore] = useState(DEFAULT_BULK_SCORE)
    const [busy, setBusy] = useState(false)
    const count = ready.filter((item) => item.score !== null && item.score >= minScore).length

    const approve = async () => {
        if (!window.confirm(`¿Aprobar ${count} ofertas con match de ${minScore}% o más? Claude va a postular a todas las aprobadas.`)) return
        setBusy(true)
        try {
            const result = await approveQueueByScore(minScore)
            if (!result.ok) return void toast.error(result.message)
            onApproved(minScore)
            toast.success(`Aprobaste ${result.data.approved}.`)
        } catch {
            toast.error('No se pudieron aprobar')
        } finally {
            setBusy(false)
        }
    }

    if (ready.length === 0) return null
    return (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
            <label htmlFor="bulkScore">Aprobar todas las de match ≥</label>
            <Input
                id="bulkScore"
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(event) => setMinScore(Number(event.target.value))}
                className="w-20"
            />
            <span>%</span>
            <Button size="sm" onClick={approve} disabled={busy || count === 0}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                Aprobar {count}
            </Button>
        </div>
    )
}

function QueueList({
    items,
    empty,
    variant = 'pending',
    onStatus,
    onSkip,
}: {
    items: QueueItem[]
    empty: string
    variant?: QueueCardVariant
    onStatus: OnStatus
    onSkip?: OnSkip
}) {
    if (items.length === 0) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>
    return (
        <ul className="space-y-3">
            {items.map((item) => (
                <QueueCard key={item.id} item={item} variant={variant} onStatus={onStatus} onSkip={onSkip} />
            ))}
        </ul>
    )
}

export function QueueBoard({ initial }: { initial: QueueData }) {
    const [pending, setPending] = useState(initial.pending)
    const [submitted, setSubmitted] = useState(initial.submitted)

    const skipItem: OnSkip = async (item, reason, detail) => {
        try {
            const result = await skipApplication(item.id, reason, detail)
            if (!result.ok) return void toast.error(result.message)
            setPending((current) => current.filter((entry) => entry.id !== item.id))
            toast.success('Descartada')
            for (const learned of result.data.learned) {
                toast.message(`KeyWords aprendió: ${LEARNED_LABELS[learned.kind](learned.value)}`, {
                    description: 'Lo ves y lo podés borrar en "Búsqueda diaria de ofertas".',
                })
            }
        } catch {
            toast.error('No se pudo descartar')
        }
    }

    const changeStatus = async (item: QueueItem, status: ApplicationStatusValue) => {
        try {
            await updateApplicationStatus(item.id, status)
            // Lo que sale de los estados de la cola desaparece de esta vista
            setPending((current) =>
                ['READY', 'APPROVED', 'NEEDS_USER'].includes(status)
                    ? current.map((entry) => (entry.id === item.id ? { ...entry, status } : entry))
                    : current.filter((entry) => entry.id !== item.id)
            )
        } catch {
            toast.error('No se pudo cambiar el estado')
        }
    }

    // Una enviada sigue en su lista: solo cambia la respuesta de la empresa
    const changeSubmittedStatus = async (item: QueueItem, status: ApplicationStatusValue) => {
        try {
            await updateApplicationStatus(item.id, status)
            setSubmitted((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status } : entry)))
        } catch {
            toast.error('No se pudo cambiar el estado')
        }
    }

    // Mismo criterio que el servidor: las por aprobar con match igual o mayor pasan a aprobadas
    const markApproved = (minScore: number) =>
        setPending((current) =>
            current.map((entry) =>
                entry.status === 'READY' && entry.score !== null && entry.score >= minScore ? { ...entry, status: 'APPROVED' } : entry
            )
        )

    const byStatus = (status: string) => pending.filter((item) => item.status === status)
    const ready = byStatus('READY')
    const approved = byStatus('APPROVED')
    const needsUser = byStatus('NEEDS_USER')

    return (
        <Tabs defaultValue={needsUser.length > 0 ? 'needs-user' : 'approved'} className="space-y-4">
            <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="ready">Por aprobar ({ready.length})</TabsTrigger>
                <TabsTrigger value="approved">Aprobadas ({approved.length})</TabsTrigger>
                <TabsTrigger value="needs-user">Requieren acción ({needsUser.length})</TabsTrigger>
                <TabsTrigger value="submitted">Enviadas por Claude ({submitted.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="ready">
                <BulkApprove ready={ready} onApproved={markApproved} />
                <QueueList items={ready} onStatus={changeStatus} onSkip={skipItem} empty="No hay ofertas esperando tu aprobación." />
            </TabsContent>
            <TabsContent value="approved">
                <QueueList
                    items={approved}
                    onStatus={changeStatus}
                    onSkip={skipItem}
                    empty='No hay ofertas aprobadas. Cargá una con "Que la complete Claude" o aprobá alguna de la cola.'
                />
            </TabsContent>
            <TabsContent value="needs-user">
                <QueueList items={needsUser} onStatus={changeStatus} onSkip={skipItem} empty="Nada trabado: Claude no necesitó ayuda." />
            </TabsContent>
            <TabsContent value="submitted">
                <QueueList
                    items={submitted}
                    variant="submitted"
                    onStatus={changeSubmittedStatus}
                    empty="Claude todavía no envió ninguna postulación."
                />
            </TabsContent>
        </Tabs>
    )
}
