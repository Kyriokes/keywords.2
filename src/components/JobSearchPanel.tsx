'use client'

import { useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { runJobSearchNow, saveJobSearchSettings, type JobSearchSettingsData } from '@/actions/job-search-actions'
import { AGGREGATOR_SOURCES, SOURCE_LABELS } from '@/lib/ingest/sources'

const dateTimeFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

export function JobSearchPanel({ initial }: { initial: JobSearchSettingsData }) {
    const router = useRouter()
    const [enabled, setEnabled] = useState(initial.enabled)
    const [sources, setSources] = useState<string[]>(initial.sources)
    const [boards, setBoards] = useState(initial.atsBoards.join('\n'))
    const [minScore, setMinScore] = useState(initial.minScore)
    const [maxPerRun, setMaxPerRun] = useState(initial.maxPerRun)
    const [lastResult, setLastResult] = useState(initial.lastResult)
    const [lastRunAt, setLastRunAt] = useState(initial.lastRunAt)
    const [busy, setBusy] = useState<'save' | 'run' | null>(null)

    const toggleSource = (source: string) =>
        setSources((current) => (current.includes(source) ? current.filter((item) => item !== source) : [...current, source]))

    const save = async () => {
        setBusy('save')
        try {
            const result = await saveJobSearchSettings({
                enabled,
                sources,
                atsBoards: boards.split(/[\n,]/),
                minScore,
                maxPerRun,
            })
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

    return (
        <details className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <summary className="cursor-pointer p-4 font-medium">
                Búsqueda diaria de ofertas {initial.enabled ? '· activada' : '· desactivada'}
            </summary>
            <div className="space-y-5 border-t p-4">
                <p className="text-sm text-muted-foreground">
                    Todos los días se revisan portales con API pública. Las ofertas de tus puestos deseados que encajan con tu CV
                    entran a &quot;Por aprobar&quot;. No usa tokens de Claude.
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
                        <strong>netflix</strong>, jobs.ashbyhq.com/<strong>notion</strong>.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="minScore">Match mínimo con tu CV (%)</Label>
                        <Input id="minScore" type="number" min={0} max={100} value={minScore} onChange={(event) => setMinScore(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="maxPerRun">Ofertas nuevas por día (máximo)</Label>
                        <Input id="maxPerRun" type="number" min={1} max={25} value={maxPerRun} onChange={(event) => setMaxPerRun(Number(event.target.value))} />
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
                    <Button variant="outline" onClick={runNow} disabled={busy !== null}>
                        {busy === 'run' ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                        Buscar ahora
                    </Button>
                </div>
            </div>
        </details>
    )
}
