'use client'

import { useCvStore } from '@/store/cvStore'
import { usePositionStore } from '@/store/PositionStore'

export default function DebugPage() {
  const { keywords, rawText, setKeyWords, clearKeyWords, setRawText } = useCvStore()
  const { positions, setPositions, clearPositions } = usePositionStore()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Debug Stores</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* CV Store Section */}
        <div className="space-y-4 border p-4 rounded-lg">
          <h2 className="text-xl font-semibold">CV Store</h2>
          
          <div className="flex gap-2">
            <button
              onClick={() => setKeyWords(['react', 'typescript', 'zustand'])}
              className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Cargar keywords
            </button>

            <button
              onClick={clearKeyWords}
              className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400 transition-colors"
            >
              Limpiar Keywords
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-semibold">Raw Text:</label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700"
              rows={4}
              placeholder="Escribe algo aquí para actualizar rawText..."
            />
          </div>

          <pre className="bg-gray-100 dark:bg-neutral-800 p-4 rounded overflow-auto h-40">
            {JSON.stringify({ keywords, rawText }, null, 2)}
          </pre>
        </div>

        {/* Position Store Section */}
        <div className="space-y-4 border p-4 rounded-lg">
          <h2 className="text-xl font-semibold">Position Store</h2>
          
          <div className="flex gap-2">
            <button
              onClick={() => setPositions(['Frontend Developer', 'Backend Developer', 'Full Stack'])}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Cargar Positions
            </button>

            <button
              onClick={clearPositions}
              className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400 transition-colors"
            >
              Limpiar Positions
            </button>
          </div>

          <pre className="bg-gray-100 dark:bg-neutral-800 p-4 rounded overflow-auto h-40">
            {JSON.stringify({ positions }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
