'use client'

import { useState } from 'react'
import { FlaskConical, Loader2, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    previewJobSearch,
    runJobSearchNow,
    saveJobSearchSettings,
    type JobSearchSettingsData,
} from '@/actions/job-search-actions'
import { SENIORITY_POLICIES, SENIORITY_POLICY_LABELS, WORK_MODES, WORK_MODE_LABELS } from '@/lib/ingest/eligibility'
import type { SearchDecision } from '@/lib/ingest/run'
import { AGGREGATOR_SOURCES, SOURCE_LABELS } from '@/lib/ingest/sources'
import { LIMITS } from '@/lib/validation'

const dateTimeFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

interface Preview {
    summary: string
    decisions: SearchDecision[]
    errors: string[]
}

/** Resultado de "Probar filtros": primero lo que entraría, después lo descartado con su motivo. */
function PreviewResults({ preview }: { preview: Preview }) {
    const passes = preview.decisions.filter((decision) => decision.status !== 'REJECTED')
    const rejected = preview.decisions.filter((decision) => decision.status === 'REJECTED')

    return (
        <div className="space-y-3 rounded-md border p-3 text-sm">
            <p className="font-medium">{preview.summary}</p>
            {preview.errors.length > 0 && (
                <p className="text-xs text-muted-foreground">No respondieron: {preview.errors.join(' · ')}</p>
            )}
            {[
                { title: `Entrarían (${passes.length})`, items: passes },
                { title: `Descartadas (${rejected.length})`, items: rejected },
            ].map(
                (group) =>
                    group.items.length > 0 && (
                        <details key={group.title} open={group.items === passes}>
                            <summary className="cursor-pointer font-medium">{group.title}</summary>
                            <ul className="mt-2 divide-y">
                                {group.items.map((decision) => (
                                    <li key={decision.externalId} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2">
                                        <a href={decision.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
                                            {decision.title}
                                        </a>
                                        <span className="text-muted-foreground">
                                            {[decision.company, decision.location].filter(Boolean).join(' · ')}
                                        </span>
                                        {decision.score !== null && <Badge variant="outline">match {decision.score}%</Badge>}
                                        {decision.summary && <span className="text-xs text-muted-foreground">{decision.summary}</span>}
                                        {decision.reason && (
                                            <Badge variant="secondary" className="basis-full sm:basis-auto">
                                                {decision.reason}
                                            </Badge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )
            )}
        </div>
    )
}

export function JobSearchPanel({ initial }: { initial: JobSearchSettingsData }) {
    const router = useRouter()
    const [enabled, setEnabled] = useState(initial.enabled)
    const [sources, setSources] = useState<string[]>(initial.sources)
    const [boards, setBoards] = useState(initial.atsBoards.join('\n'))
    const [minScore, setMinScore] = useState(initial.minScore)
    const [maxPerRun, setMaxPerRun] = useState(initial.maxPerRun)
    const [workModes, setWorkModes] = useState<string[]>(initial.workModes)
    const [seniorityPolicy, setSeniorityPolicy] = useState(initial.seniorityPolicy)
    const [lastResult, setLastResult] = useState(initial.lastResult)
    const [lastRunAt, setLastRunAt] = useState(initial.lastRunAt)
    const [preview, setPreview] = useState<Preview | null>(null)
    const [busy, setBusy] = useState<'save' | 'run' | 'preview' | null>(null)

    // Las sugeridas que ya se escribieron en la caja dejan de ofrecerse
    const typedBoards = new Set(boards.split(/[\n,]/).map((board) => board.trim().toLowerCase()))
    const suggestions = initial.suggestedBoards.filter((suggestion) => !typedBoards.has(suggestion.board))

    const toggle = (setter: typeof setSources) => (value: string) =>
        setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))
    const toggleSource = toggle(setSources)
    const toggleWorkMode = toggle(setWorkModes)

    const currentSettings = () => ({
        enabled,
        sources,
        atsBoards: boards.split(/[\n,]/),
        minScore,
        maxPerRun,
        workModes,
        seniorityPolicy,
    })

    const save = async () => {
        setBusy('save')
        try {
            const result = await saveJobSearchSettings(currentSettings())
            if (!result.ok) return void toast.error(result.message)
            toast.success(enabled ? 'Listo: se busca todos los días a las 8 (hora de Argentina)' : 'Configuración guardada')
        } catch {
            toast.error('No se pudo guardar')
        } finally {
            setBusy(null)
        }
    }

    const runNow = async () => {
        setBusy('run')
        try {
            const result = await runJobSearchNow()
            if (!result.ok) return void toast.error(result.message)
            setLastResult(result.data.summary)
            setLastRunAt(new Date().toISOString())
            toast.success(result.data.summary)
            // Las ofertas nuevas aparecen en "Por aprobar"
            router.refresh()
        } catch {
            toast.error('La búsqueda falló')
        } finally {
            setBusy(null)
        }
    }

    const runPreview = async () => {
        setBusy('preview')
        try {
            const result = await previewJobSearch(currentSettings())
            if (!result.ok) return void toast.error(result.message)
            setPreview(result.data)
        } catch {
            toast.error('No se pudieron probar los filtros')
        } finally {
            setBusy(null)
        }
    }

    return (
        <details className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <summary className="cursor-pointer p-4 font-medium">
                Búsqueda diaria de ofertas {initial.enabled ? '· activada' : '· desactivada'}
            </summary>
            <div className="space-y-5 border-t p-4">
                <p className="text-sm text-muted-foreground">
                    Todos los días se revisan portales con API pública. Las ofertas de tus puestos deseados que encajan con tu CV
                    y pasan los filtros entran a &quot;Por aprobar&quot;. No usa tokens de Claude.
                </p>

                <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4" />
                    Buscar todos los días
                </label>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Portales</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {AGGREGATOR_SOURCES.map((source) => (
                            <label key={source} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={sources.includes(source)} onChange={() => toggleSource(source)} className="size-4" />
                                {SOURCE_LABELS[source]}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="space-y-2">
                    <Label htmlFor="atsBoards">Empresas a seguir (una por línea)</Label>
                    <Textarea
                        id="atsBoards"
                        value={boards}
                        onChange={(event) => setBoards(event.target.value)}
                        placeholder={'greenhouse:stripe\nlever:netflix\nashby:notion'}
                        className="min-h-24 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        El nombre sale del link de empleos de la empresa: boards.greenhouse.io/<strong>stripe</strong>, jobs.lever.co/
                        <strong>netflix</strong>, jobs.ashbyhq.com/<strong>notion</strong>, apply.workable.com/<strong>workstate</strong>,
                        jobs.smartrecruiters.com/<strong>Endava</strong> (de SmartRecruiters se toman las publicadas en Argentina).
                    </p>
                    {suggestions.length > 0 && (
                        <div className="space-y-2 rounded-md bg-muted px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                Empresas de tus ofertas que podrías seguir. Tocá para sumarlas y después guardá:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((suggestion) => (
                                    <Button
                                        key={suggestion.board}
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setBoards((current) => (current.trim() ? `${current.trim()}\n${suggestion.board}` : suggestion.board))}
                                    >
                                        <Plus className="size-3.5" aria-hidden />
                                        {suggestion.board}
                                        <span className="text-muted-foreground">
                                            ({suggestion.offers} {suggestion.offers === 1 ? 'oferta' : 'ofertas'})
                                        </span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Modalidades que aceptás</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {WORK_MODES.map((mode) => (
                            <label key={mode} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={workModes.includes(mode)} onChange={() => toggleWorkMode(mode)} className="size-4" />
                                {WORK_MODE_LABELS[mode]}
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Siempre se descartan las que piden ciudadanía, vivir en otro país, permiso de trabajo de otro país o mudarse.
                    </p>
                </fieldset>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Hasta qué nivel postular</legend>
                    {SENIORITY_POLICIES.map((policy) => (
                        <label key={policy} className="flex items-center gap-2 text-sm">
                            <input
                                type="radio"
                                name="seniorityPolicy"
                                checked={seniorityPolicy === policy}
                                onChange={() => setSeniorityPolicy(policy)}
                                className="size-4"
                            />
                            {SENIORITY_POLICY_LABELS[policy]}
                        </label>
                    ))}
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="minScore">Match mínimo con tu CV (%)</Label>
                        <Input id="minScore" type="number" min={0} max={100} value={minScore} onChange={(event) => setMinScore(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="maxPerRun">Ofertas nuevas por búsqueda (máximo)</Label>
                        <Input
                            id="maxPerRun"
                            type="number"
                            min={1}
                            max={LIMITS.searchMaxPerRun}
                            value={maxPerRun}
                            onChange={(event) => setMaxPerRun(Number(event.target.value))}
                        />
                    </div>
                </div>

                {lastResult && (
                    <p className="rounded-md bg-muted px-3 py-2 text-sm">
                        {lastRunAt && <span className="text-muted-foreground">{dateTimeFormatter.format(new Date(lastRunAt))}: </span>}
                        {lastResult}
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    <Button onClick={save} disabled={busy !== null}>
                        {busy === 'save' && <Loader2 className="size-4 animate-spin" />}
                        Guardar
                    </Button>
                    <Button variant="outline" onClick={runPreview} disabled={busy !== null}>
                        {busy === 'preview' ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
                        Probar filtros
                    </Button>
                    <Button variant="outline" onClick={runNow} disabled={busy !== null}>
                        {busy === 'run' ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                        Buscar ahora
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    &quot;Probar filtros&quot; usa lo que ves en pantalla aunque no lo hayas guardado, y no carga nada en la cola.
                </p>

                {preview && <PreviewResults preview={preview} />}
            </div>
        </details>
    )
}
