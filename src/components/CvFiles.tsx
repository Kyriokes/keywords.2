'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateCvFile } from '@/actions/cv-actions'
import { useCvStore, type CV } from '@/store/cvStore'

const LANGUAGE_LABELS: Record<string, string> = { en: 'Inglés', es: 'Español' }

/** Idioma, link y ruta de un CV: lo que usa Claude para subir el archivo en cada formulario. */
function CvFileRow({ cv, onSaved }: { cv: CV; onSaved: () => void }) {
    const initial = { language: cv.language ?? '', fileUrl: cv.fileUrl ?? '', filePath: cv.filePath ?? '' }
    const [draft, setDraft] = useState(initial)
    const [saving, setSaving] = useState(false)
    const changed = draft.language !== initial.language || draft.fileUrl !== initial.fileUrl || draft.filePath !== initial.filePath

    const save = async () => {
        setSaving(true)
        try {
            const result = await updateCvFile(cv.id, { ...draft, language: draft.language || null })
            if (!result.ok) return void toast.error(result.message)
            toast.success('Archivo del CV guardado')
            onSaved()
        } catch {
            toast.error('No se pudo guardar el archivo del CV')
        } finally {
            setSaving(false)
        }
    }

    const id = (field: string) => `cv-${cv.id}-${field}`
    return (
        <div className="space-y-3 rounded-lg border p-3">
            <p className="truncate text-sm font-medium" title={cv.name}>
                {cv.name} {cv.isPrimary && <span className="text-xs text-primary">(activo)</span>}
            </p>
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <div className="space-y-1">
                    <Label htmlFor={id('language')}>Idioma</Label>
                    <select
                        id={id('language')}
                        value={draft.language}
                        onChange={(event) => setDraft({ ...draft, language: event.target.value })}
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                        <option value="">Sin elegir</option>
                        {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor={id('url')}>Link público al PDF</Label>
                    <Input
                        id={id('url')}
                        value={draft.fileUrl}
                        onChange={(event) => setDraft({ ...draft, fileUrl: event.target.value })}
                        placeholder="https://tu-portfolio.com/cv.pdf"
                    />
                </div>
            </div>
            <div className="space-y-1">
                <Label htmlFor={id('path')}>Ruta del PDF en tu PC</Label>
                <Input
                    id={id('path')}
                    value={draft.filePath}
                    onChange={(event) => setDraft({ ...draft, filePath: event.target.value })}
                    placeholder="C:\Users\vos\Documents\cv.pdf"
                    className="font-mono text-sm"
                />
            </div>
            {changed && (
                <Button size="sm" onClick={save} disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    Guardar
                </Button>
            )}
        </div>
    )
}

/** Archivos de los CV para postular: Claude sube el del idioma de cada oferta. */
export function CvFiles() {
    const { cvs, fetchCVs } = useCvStore()
    if (cvs.length === 0) return null

    return (
        <div className="space-y-3 border-t pt-4">
            <h3 className="text-lg font-semibold">Archivos para postular</h3>
            <p className="text-sm text-muted-foreground">
                Cuando un formulario pide el CV, Claude sube el PDF del idioma de la oferta desde la ruta de tu PC. El link sirve para
                los formularios que piden la dirección del CV.
            </p>
            {cvs.map((cv) => (
                // La clave incluye los datos guardados para que el formulario se reinicie al recargarlos
                <CvFileRow key={`${cv.id}-${cv.language}-${cv.fileUrl}-${cv.filePath}`} cv={cv} onSaved={fetchCVs} />
            ))}
        </div>
    )
}
