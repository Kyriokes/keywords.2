'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    addVideoLink,
    deleteAnswerTemplate,
    deleteCoverLetterTemplate,
    deleteMediaAsset,
    saveAnswerTemplate,
    saveCoverLetterTemplate,
    type AnswerTemplateItem,
    type CoverLetterTemplateItem,
    type MediaAssetItem,
    type TemplatesData,
} from '@/actions/template-actions'

// Las preguntas que más aparecen en los formularios: un clic y queda lista para responder
const COMMON_QUESTIONS: { question: string; tags: string[] }[] = [
    { question: 'Pretensión salarial', tags: ['salary'] },
    { question: '¿Necesitás sponsorship de visa para trabajar en EE.UU.?', tags: ['visa'] },
    { question: '¿Estás autorizado a trabajar en el país de la oferta?', tags: ['visa', 'authorization'] },
    { question: 'Disponibilidad para empezar / preaviso', tags: ['notice'] },
    { question: 'Nivel de inglés', tags: ['english'] },
    { question: 'Ubicación y zona horaria', tags: ['location'] },
    { question: 'Perfil de LinkedIn', tags: ['links'] },
    { question: 'Portfolio o GitHub', tags: ['links'] },
    { question: '¿Por qué te interesa este puesto?', tags: ['motivation'] },
    { question: 'Teléfono de contacto', tags: ['contact'] },
]

const emptyAnswer = { id: undefined as string | undefined, question: '', answer: '', tags: '' }
const emptyLetter = { id: undefined as string | undefined, name: '', text: '' }

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <section className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
                <p className="text-muted-foreground">{description}</p>
            </div>
            {children}
        </section>
    )
}

export function TemplatesManager({ initial }: { initial: TemplatesData }) {
    const [answers, setAnswers] = useState<AnswerTemplateItem[]>(initial.answers)
    const [letters, setLetters] = useState<CoverLetterTemplateItem[]>(initial.coverLetters)
    const [media, setMedia] = useState<MediaAssetItem[]>(initial.media)

    const [answerDraft, setAnswerDraft] = useState(emptyAnswer)
    const [letterDraft, setLetterDraft] = useState(emptyLetter)
    const [videoDraft, setVideoDraft] = useState({ name: 'Video de presentación', url: '' })
    const [saving, setSaving] = useState<string | null>(null)

    const existingQuestions = new Set(answers.map((item) => item.question.toLowerCase()))
    const suggestions = COMMON_QUESTIONS.filter((item) => !existingQuestions.has(item.question.toLowerCase()))

    const handleSaveAnswer = async () => {
        setSaving('answer')
        try {
            const result = await saveAnswerTemplate({
                id: answerDraft.id,
                question: answerDraft.question,
                answer: answerDraft.answer,
                tags: answerDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
            })
            if (!result.ok) return void toast.error(result.message)
            setAnswers((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)])
            setAnswerDraft(emptyAnswer)
            toast.success('Respuesta guardada')
        } catch {
            toast.error('No se pudo guardar la respuesta')
        } finally {
            setSaving(null)
        }
    }

    const handleSaveLetter = async () => {
        setSaving('letter')
        try {
            const result = await saveCoverLetterTemplate(letterDraft)
            if (!result.ok) return void toast.error(result.message)
            setLetters((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)])
            setLetterDraft(emptyLetter)
            toast.success('Carta guardada')
        } catch {
            toast.error('No se pudo guardar la carta')
        } finally {
            setSaving(null)
        }
    }

    const handleAddVideo = async () => {
        setSaving('video')
        try {
            const result = await addVideoLink(videoDraft)
            if (!result.ok) return void toast.error(result.message)
            setMedia((current) => [result.data, ...current])
            setVideoDraft({ name: 'Video de presentación', url: '' })
            toast.success('Video guardado')
        } catch {
            toast.error('No se pudo guardar el video')
        } finally {
            setSaving(null)
        }
    }

    const remove = async (kind: 'answer' | 'letter' | 'video', id: string) => {
        if (!window.confirm('¿Borrar? No se puede deshacer.')) return
        try {
            if (kind === 'answer') {
                await deleteAnswerTemplate(id)
                setAnswers((current) => current.filter((item) => item.id !== id))
            } else if (kind === 'letter') {
                await deleteCoverLetterTemplate(id)
                setLetters((current) => current.filter((item) => item.id !== id))
            } else {
                await deleteMediaAsset(id)
                setMedia((current) => current.filter((item) => item.id !== id))
            }
        } catch {
            toast.error('No se pudo borrar')
        }
    }

    return (
        <div className="space-y-12">
            <Section
                title="Respuestas tipo"
                description="Claude las usa para completar los formularios en lugar de inventar. Cuando respondas una pregunta nueva durante una postulación, también se puede guardar acá."
            >
                <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
                    {suggestions.length > 0 && !answerDraft.id && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Preguntas frecuentes:</p>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((item) => (
                                    <Button
                                        key={item.question}
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setAnswerDraft({ ...emptyAnswer, question: item.question, tags: item.tags.join(', ') })}
                                    >
                                        <Plus className="size-3" />
                                        {item.question}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="answerQuestion">Pregunta</Label>
                        <Input
                            id="answerQuestion"
                            value={answerDraft.question}
                            onChange={(event) => setAnswerDraft({ ...answerDraft, question: event.target.value })}
                            placeholder="Ej: Pretensión salarial"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="answerText">Tu respuesta</Label>
                        <Textarea
                            id="answerText"
                            value={answerDraft.answer}
                            onChange={(event) => setAnswerDraft({ ...answerDraft, answer: event.target.value })}
                            placeholder="Ej: USD 4.000 mensuales, negociable según beneficios"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="answerTags">Etiquetas (opcional, separadas por coma)</Label>
                        <Input
                            id="answerTags"
                            value={answerDraft.tags}
                            onChange={(event) => setAnswerDraft({ ...answerDraft, tags: event.target.value })}
                            placeholder="salary, visa, notice..."
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSaveAnswer} disabled={saving === 'answer'}>
                            {saving === 'answer' && <Loader2 className="size-4 animate-spin" />}
                            {answerDraft.id ? 'Guardar cambios' : 'Agregar respuesta'}
                        </Button>
                        {answerDraft.id && (
                            <Button variant="ghost" onClick={() => setAnswerDraft(emptyAnswer)}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>

                {answers.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                        {answers.map((item) => (
                            <li key={item.id} className="flex items-start justify-between gap-4 p-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="font-medium">{item.question}</p>
                                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.answer}</p>
                                    {item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {item.tags.map((tag) => (
                                                <Badge key={tag} variant="secondary">{tag}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Editar"
                                        onClick={() => setAnswerDraft({ id: item.id, question: item.question, answer: item.answer, tags: item.tags.join(', ') })}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label="Borrar" onClick={() => remove('answer', item.id)}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section
                title="Cartas de presentación modelo"
                description="Claude parte de una de estas cartas y la adapta a cada oferta. La que se envía queda registrada en la postulación."
            >
                <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
                    <div className="space-y-2">
                        <Label htmlFor="letterName">Nombre</Label>
                        <Input
                            id="letterName"
                            value={letterDraft.name}
                            onChange={(event) => setLetterDraft({ ...letterDraft, name: event.target.value })}
                            placeholder="Ej: Remoto USA, en inglés"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="letterText">Carta</Label>
                        <Textarea
                            id="letterText"
                            className="min-h-48"
                            value={letterDraft.text}
                            onChange={(event) => setLetterDraft({ ...letterDraft, text: event.target.value })}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSaveLetter} disabled={saving === 'letter'}>
                            {saving === 'letter' && <Loader2 className="size-4 animate-spin" />}
                            {letterDraft.id ? 'Guardar cambios' : 'Agregar carta'}
                        </Button>
                        {letterDraft.id && (
                            <Button variant="ghost" onClick={() => setLetterDraft(emptyLetter)}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>

                {letters.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                        {letters.map((item) => (
                            <li key={item.id} className="flex items-start justify-between gap-4 p-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="font-medium">{item.name}</p>
                                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.text}</p>
                                </div>
                                <div className="flex shrink-0">
                                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setLetterDraft(item)}>
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label="Borrar" onClick={() => remove('letter', item.id)}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section
                title="Video de presentación"
                description="Grabá un video genérico y subilo como no listado a YouTube, Loom o Drive. Pegá el link acá y Claude lo usa cuando un formulario lo pida."
            >
                <div className="flex flex-col gap-2 rounded-lg border bg-card p-6 shadow-sm sm:flex-row">
                    <Input
                        aria-label="Nombre del video"
                        value={videoDraft.name}
                        onChange={(event) => setVideoDraft({ ...videoDraft, name: event.target.value })}
                        className="sm:max-w-56"
                    />
                    <Input
                        aria-label="Link del video"
                        value={videoDraft.url}
                        onChange={(event) => setVideoDraft({ ...videoDraft, url: event.target.value })}
                        placeholder="https://youtu.be/..."
                    />
                    <Button onClick={handleAddVideo} disabled={saving === 'video'} className="shrink-0">
                        {saving === 'video' && <Loader2 className="size-4 animate-spin" />}
                        Guardar
                    </Button>
                </div>

                {media.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                        {media.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-4 p-4">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline">
                                    <span className="truncate">{item.name}</span>
                                    <ExternalLink className="size-3 shrink-0" />
                                </a>
                                <Button variant="ghost" size="icon" aria-label="Borrar" onClick={() => remove('video', item.id)}>
                                    <Trash2 className="size-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    )
}
