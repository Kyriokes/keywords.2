'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePositionStore } from '@/store/PositionStore'

const MAX_POSITIONS = 10
const MAX_RESULTS = 8

export function DesiredPositions() {
    const { positions, availableRoles, unrecognized, setPositions, fetchPositions, isLoading } = usePositionStore()

    // null mientras el usuario no tocó nada: se muestra lo guardado
    const [draft, setDraft] = useState<string[] | null>(null)
    const [query, setQuery] = useState('')

    // Cargar posiciones al montar
    useEffect(() => {
        fetchPositions();
    }, [fetchPositions]);

    const selected = draft ?? positions
    const isFull = selected.length >= MAX_POSITIONS
    const hasChanges = draft !== null || unrecognized.length > 0

    const search = query.trim().toLowerCase()
    const matches = availableRoles.filter((role) => !selected.includes(role) && role.toLowerCase().includes(search))
    const results = matches.slice(0, MAX_RESULTS)

    const add = (role: string) => {
        if (!isFull) setDraft([...selected, role])
    }

    const remove = (role: string) => {
        setDraft(selected.filter((item) => item !== role))
    }

    const handleSave = async () => {
        try {
            await setPositions(selected)
            setDraft(null)
            setQuery('')
            toast.success('Puestos guardados correctamente')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error al guardar puestos')
        }
    }

    return (
        <section className="space-y-5 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                    {selected.length === 0
                        ? 'Todavía no elegiste ningún puesto.'
                        : `Elegiste ${selected.length} de ${MAX_POSITIONS}.`}
                </p>
                {selected.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                        {selected.map((role) => (
                            <li key={role}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 rounded-full"
                                    onClick={() => remove(role)}
                                    disabled={isLoading}
                                    aria-label={`Quitar ${role}`}
                                >
                                    {role}
                                    <X className="size-3.5" aria-hidden />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {unrecognized.length > 0 && (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Tenías guardados puestos que no corresponden a ningún rol: {unrecognized.join(', ')}.
                    No se conservan al guardar; buscá abajo el rol más parecido.
                </p>
            )}

            <div className="space-y-2">
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={isFull ? 'Quitá un puesto para sumar otro' : 'Buscar un rol, por ejemplo Backend'}
                    aria-label="Buscar un rol para agregar"
                    disabled={isLoading || isFull}
                />
                {!isFull && (
                    results.length > 0 ? (
                        <>
                            <ul className="flex flex-wrap gap-2">
                                {results.map((role) => (
                                    <li key={role}>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-full"
                                            onClick={() => add(role)}
                                            disabled={isLoading}
                                        >
                                            {role}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                            {matches.length > results.length && (
                                <p className="text-xs text-muted-foreground">
                                    Hay {matches.length - results.length} roles más; escribí para acotar.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {availableRoles.length === 0
                                ? 'Todavía no hay roles cargados en el diccionario.'
                                : 'Ningún rol coincide con esa búsqueda.'}
                        </p>
                    )
                )}
            </div>

            <Button onClick={handleSave} disabled={isLoading || !hasChanges} className="w-full">
                {isLoading ? <Loader2 className="animate-spin" /> : null}
                {isLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
        </section>
    )
}
