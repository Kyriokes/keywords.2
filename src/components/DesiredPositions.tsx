'use client'

import { useState, useEffect } from 'react'
import { usePositionStore } from '@/store/PositionStore'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function DesiredPositions() {
    const { positions, setPositions, fetchPositions, isLoading } = usePositionStore()
    const [quantity, setQuantity] = useState(1)
    const [localPositions, setLocalPositions] = useState<string[]>([''])

    // Cargar posiciones al montar
    useEffect(() => {
        fetchPositions();
    }, [fetchPositions]);

    // Sincronizar estado local cuando llegan datos del servidor
    useEffect(() => {
         if (positions.length > 0) {
             setLocalPositions(prev => {
                 // Solo actualizar si es diferente para evitar loops
                 if (JSON.stringify(prev) !== JSON.stringify(positions)) {
                    setQuantity(positions.length);
                    return positions;
                }
                return prev;
            })
        }
    }, [positions])

    const handleQuantityChange = (newQuantity: number) => {
        setQuantity(newQuantity)
        setLocalPositions(prev => {
            const newPositions = [...prev]
            if (newQuantity > prev.length) {
                // Agregar inputs vacíos
                for (let i = prev.length; i < newQuantity; i++) {
                    newPositions.push('')
                }
            } else {
                // Recortar inputs
                newPositions.length = newQuantity
            }
            return newPositions
        })
    }

    const handleInputChange = (index: number, value: string) => {
        const newPositions = [...localPositions]
        newPositions[index] = value
        setLocalPositions(newPositions)
    }

    const handleSave = async () => {
        try {
            await setPositions(localPositions)
            toast.success('Puestos guardados correctamente')
        } catch (error) {
            toast.error('Error al guardar puestos')
        }
    }

    return (
        <section className="p-6 border rounded-lg shadow-sm bg-card text-card-foreground max-w-2xl mx-auto my-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Puestos Deseados</h2>
            
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4 justify-center">
                    <label className="font-medium">Cantidad de puestos:</label>
                    <div className="flex items-center gap-3 bg-secondary/50 border rounded-md p-1">
                        <button
                            onClick={() => quantity > 1 && handleQuantityChange(quantity - 1)}
                            disabled={quantity <= 1 || isLoading}
                            className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold"
                            aria-label="Disminuir cantidad"
                        >
                            -
                        </button>
                        <span className="w-8 text-center font-medium">{quantity}</span>
                        <button
                            onClick={() => quantity < 10 && handleQuantityChange(quantity + 1)}
                            disabled={quantity >= 10 || isLoading}
                            className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold"
                            aria-label="Aumentar cantidad"
                        >
                            +
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {localPositions.map((pos, index) => (
                        <div key={index} className="flex flex-col gap-1">
                            <label className="text-sm text-muted-foreground">Puesto #{index + 1}</label>
                            <input
                                type="text"
                                value={pos}
                                onChange={(e) => handleInputChange(index, e.target.value)}
                                placeholder="Ej: Frontend Developer"
                                disabled={isLoading}
                                className="w-full p-3 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                            />
                        </div>
                    ))}
                </div>

                <button 
                    onClick={handleSave}
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : null}
                    {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
        </section>
    )
}
