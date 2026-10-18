'use client'

import { useState } from 'react'
import { Check, ExternalLink, Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { updateApplicationStatus } from '@/actions/application-actions'
import {
    generateApplicationCoverLetter,
    saveApplicationCoverLetter,
    type QueueData,
    type QueueItem,
} from '@/actions/queue-actions'
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
}

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
                        Todavía no hay carta. Se genera sola al aprobar la oferta, o generala ahora.
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

function QueueCard({ item, onStatus }: { item: QueueItem; onStatus?: (item: QueueItem, status: ApplicationStatusValue) => void }) {
    const formUrl = item.applyUrl ?? item.link
    // En las pendientes la carta se edita aparte; en las enviadas es parte de lo que se envió
    const isPending = !!onStatus
    const hasRecord = item.answers.length > 0 || !!item.cvVariantName || (!isPending && !!item.coverLetter)

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

            {onStatus && ACTIONS[item.status] && (
                <div className="flex flex-wrap gap-2">
                    {ACTIONS[item.status].map((action) => (
                        <Button key={action.status} size="sm" variant={action.variant ?? 'default'} onClick={() => onStatus(item, action.status)}>
                            <action.icon className="size-4" />
                            {action.label}
                        </Button>
                    ))}
                </div>
            )}
        </li>
    )
}

function QueueList({ items, empty, onStatus }: { items: QueueItem[]; empty: string; onStatus?: (item: QueueItem, status: ApplicationStatusValue) => void }) {
    if (items.length === 0) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>
    return (
        <ul className="space-y-3">
            {items.map((item) => (
                <QueueCard key={item.id} item={item} onStatus={onStatus} />
            ))}
        </ul>
    )
}

export function QueueBoard({ initial }: { initial: QueueData }) {
    const [pending, setPending] = useState(initial.pending)

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
                <TabsTrigger value="submitted">Enviadas por Claude ({initial.submitted.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="ready">
                <QueueList items={ready} onStatus={changeStatus} empty="No hay ofertas esperando tu aprobación." />
            </TabsContent>
            <TabsContent value="approved">
                <QueueList
                    items={approved}
                    onStatus={changeStatus}
                    empty='No hay ofertas aprobadas. Cargá una con "Que la complete Claude" o aprobá alguna de la cola.'
                />
            </TabsContent>
            <TabsContent value="needs-user">
                <QueueList items={needsUser} onStatus={changeStatus} empty="Nada trabado: Claude no necesitó ayuda." />
            </TabsContent>
            <TabsContent value="submitted">
                <QueueList items={initial.submitted} empty="Claude todavía no envió ninguna postulación." />
            </TabsContent>
        </Tabs>
    )
}
