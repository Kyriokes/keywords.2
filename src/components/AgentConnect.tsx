'use client'

import { useState } from 'react'
import { Check, Copy, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createAgentToken, revokeAgentToken, type AgentTokenSummary } from '@/actions/agent-token-actions'

interface AgentConnectProps {
    initialTokens: AgentTokenSummary[]
    /** URL pública del servidor MCP, ej: https://kwtools.vercel.app/api/mcp */
    mcpUrl: string
}

// Repo público con el plugin (skill /postular) que se instala en Claude Code
const PLUGIN_REPO = 'Kyriokes/KW-Claude-Plugin'

const dateFormatter =new Intl.DateTimeFormat('es', { dateStyle: 'medium' })

function CopyBlock({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('No se pudo copiar, seleccioná el texto a mano')
        }
    }

    return (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3">
            <code className="flex-1 break-all font-mono text-xs leading-relaxed">{text}</code>
            <Button variant="ghost" size="icon" onClick={copy} aria-label="Copiar" className="shrink-0">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
        </div>
    )
}

export function AgentConnect({ initialTokens, mcpUrl }: AgentConnectProps) {
    const [tokens, setTokens] = useState(initialTokens)
    const [name, setName] = useState('')
    const [newToken, setNewToken] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = async () => {
        setIsCreating(true)
        try {
            const result = await createAgentToken(name)
            if (!result.ok) {
                toast.error(result.message)
                return
            }
            setNewToken(result.data.token)
            setTokens([result.data.summary, ...tokens])
            setName('')
        } catch {
            toast.error('No se pudo crear el token')
        } finally {
            setIsCreating(false)
        }
    }

    const handleRevoke = async (token: AgentTokenSummary) => {
        if (!window.confirm(`¿Revocar "${token.name}"? Claude Code deja de poder usar tu cuenta con ese token.`)) return
        try {
            await revokeAgentToken(token.id)
            setTokens(tokens.filter((item) => item.id !== token.id))
            toast.success('Token revocado')
        } catch {
            toast.error('No se pudo revocar el token')
        }
    }

    return (
        <div className="space-y-8">
            <section className="space-y-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">1. Generá un token</h2>
                    <p className="text-sm text-muted-foreground">
                        El token le da a Claude Code acceso a tus ofertas, respuestas tipo y CV. Se muestra una sola vez.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Nombre (ej: Notebook personal)"
                        maxLength={100}
                    />
                    <Button onClick={handleCreate} disabled={isCreating} className="shrink-0">
                        {isCreating ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                        Generar token
                    </Button>
                </div>

                {newToken && (
                    <div className="space-y-4 rounded-md border border-primary/40 p-4">
                        <p className="text-sm font-medium">
                            Copiá esto ahora: cuando salgas de la página no se puede volver a ver.
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                <strong className="text-foreground">2. Conectalo a Claude Code.</strong> Pegá este comando en una terminal:
                            </p>
                            <CopyBlock
                                text={`claude mcp add --transport http --scope user keywords ${mcpUrl} --header "Authorization: Bearer ${newToken}"`}
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Solo el token, por si lo configurás de otra forma:</p>
                            <CopyBlock text={newToken} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                <strong className="text-foreground">3. Instalá la skill de postulación.</strong> Dentro de Claude Code:
                            </p>
                            <CopyBlock text={`/plugin marketplace add ${PLUGIN_REPO}`} />
                            <CopyBlock text="/plugin install keywords@keywords" />
                            <p className="text-sm text-muted-foreground">
                                Después decile a Claude &quot;postulá mi cola&quot;. Necesitás la extensión Claude in Chrome conectada.
                            </p>
                        </div>
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Tokens activos</h2>
                {tokens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no generaste ninguno.</p>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {tokens.map((token) => (
                            <li key={token.id} className="flex items-center justify-between gap-4 p-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="truncate font-medium">{token.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        <code className="font-mono">{token.prefix}…</code> · creado{' '}
                                        {dateFormatter.format(new Date(token.createdAt))} ·{' '}
                                        {token.lastUsedAt
                                            ? `usado por última vez ${dateFormatter.format(new Date(token.lastUsedAt))}`
                                            : 'sin usar'}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleRevoke(token)} aria-label={`Revocar ${token.name}`}>
                                    <Trash2 className="size-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}
