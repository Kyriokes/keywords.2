"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  approveKeyword,
  blockKeyword,
  getDictionaryQueue,
  mergeKeyword,
  mergeKnownAliases,
  searchDictionary,
  type DictionaryQueue as Queue,
  type DictionaryTarget,
  type PendingKeyword,
} from "@/actions/dictionary-actions";
import { CATEGORY_LABELS, KEYWORD_CATEGORIES, type KeywordCategory } from "@/lib/keywords/categories";
import type { ActionResult } from "@/lib/validation";

export function DictionaryQueue() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [failed, setFailed] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDictionaryQueue()
      .then((data) => {
        if (!cancelled) setQueue(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ejecuta una acción sobre un término; si sale bien lo saca de la cola
  const resolve = async (id: string, action: Promise<ActionResult>, done: string) => {
    try {
      const result = await action;
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(done);
      setQueue((previous) => previous && {
        ...previous,
        pending: previous.pending.filter((keyword) => keyword.id !== id),
        pendingTotal: previous.pendingTotal - 1,
      });
    } catch {
      toast.error("No se pudo guardar el cambio.");
    }
  };

  const mergeAllKnown = async () => {
    if (!queue) return;
    const question = queue.knownAliases === 1
      ? "Hay 1 término pendiente que el diccionario ya conoce como alias. ¿Fusionarlo con su entrada?"
      : `Hay ${queue.knownAliases} términos pendientes que el diccionario ya conoce como alias. ¿Fusionarlos con sus entradas?`;
    if (!confirm(question)) return;

    setMerging(true);
    try {
      const result = await mergeKnownAliases();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.data.merged === 1 ? "Se fusionó 1 término" : `Se fusionaron ${result.data.merged} términos`);
      setQueue(await getDictionaryQueue());
    } catch {
      toast.error("No se pudieron fusionar los términos.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diccionario de keywords</CardTitle>
        <CardDescription>
          {failed
            ? "No se pudo cargar la cola de revisión."
            : !queue
              ? "Cargando términos sin verificar…"
              : summaryText(queue)}
        </CardDescription>
      </CardHeader>
      {queue && queue.pending.length > 0 && (
        <CardContent className="space-y-4">
          {queue.knownAliases > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
              <p>
                {queue.knownAliases === 1
                  ? "1 término pendiente ya es alias de una entrada del diccionario."
                  : `${queue.knownAliases} términos pendientes ya son alias de una entrada del diccionario.`}
              </p>
              <Button size="sm" disabled={merging} onClick={mergeAllKnown}>
                {queue.knownAliases === 1 ? "Fusionarlo" : "Fusionarlos todos"}
              </Button>
            </div>
          )}
          <ul className="divide-y border-y">
            {queue.pending.map((keyword) => (
              <PendingRow key={keyword.id} keyword={keyword} onResolve={resolve} />
            ))}
          </ul>
          {queue.pendingTotal > queue.pending.length && (
            <p className="text-sm text-muted-foreground">
              Se muestran los {queue.pending.length} más pedidos. Al resolverlos, recargá para ver los siguientes.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function summaryText(queue: Queue): string {
  const size = `El diccionario tiene ${queue.dictionarySize} entradas.`;
  const share = queue.verifiedShare === null
    ? ""
    : ` El ${queue.verifiedShare}% de las menciones en postulaciones ya usa un término verificado.`;
  const pending = queue.pendingTotal === 0
    ? " No hay términos pendientes de revisión."
    : queue.pendingTotal === 1
      ? " Queda 1 término sin verificar."
      : ` Quedan ${queue.pendingTotal} términos sin verificar.`;
  return size + share + pending;
}

interface PendingRowProps {
  keyword: PendingKeyword;
  onResolve: (id: string, action: Promise<ActionResult>, done: string) => Promise<void>;
}

export function PendingRow({ keyword, onResolve }: PendingRowProps) {
  const [displayName, setDisplayName] = useState(keyword.name);
  const [category, setCategory] = useState<KeywordCategory | "">("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictionaryTarget[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async (action: Promise<ActionResult>, done: string) => {
    setBusy(true);
    await onResolve(keyword.id, action, done);
    setBusy(false);
  };

  const search = async (value: string) => {
    setQuery(value);
    try {
      setResults(value.trim() ? await searchDictionary(value) : []);
    } catch {
      setResults([]);
    }
  };

  const merge = (target: DictionaryTarget) =>
    run(mergeKeyword({ sourceId: keyword.id, targetId: target.id }), `"${keyword.name}" ahora cuenta como ${target.name}`);

  // Las sugerencias automáticas primero; debajo, lo que el admin busque a mano
  const targets = query.trim() ? results : keyword.suggestions;
  const { sameAs } = keyword;

  return (
    <li className="grid gap-3 py-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        <p className="truncate font-medium" title={keyword.name}>{keyword.name}</p>
        <p className="text-xs text-muted-foreground">
          {keyword.applications === 1 ? "La pide 1 postulación" : `La piden ${keyword.applications} postulaciones`}
        </p>
      </div>

      {sameAs ? (
        // El diccionario ya tiene este término como alias: aprobarlo crearía un duplicado
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm text-muted-foreground">
            Ya está en el diccionario como{" "}
            <span className="font-medium text-foreground">{sameAs.name}</span>
          </p>
          <Button type="button" size="sm" disabled={busy} onClick={() => merge(sameAs)}>
            Fusionar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            aria-label={`Nombre visible de ${keyword.name}`}
            className="h-8 w-40"
            disabled={busy}
          />
          <Select value={category} onValueChange={(value) => setCategory(value as KeywordCategory)} disabled={busy}>
            <SelectTrigger className="h-8 w-44" aria-label={`Categoría de ${keyword.name}`}>
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {KEYWORD_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {CATEGORY_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            disabled={busy || !category || !displayName.trim()}
            onClick={() => category && run(
              approveKeyword({ id: keyword.id, displayName, category }),
              `${displayName.trim()} se agregó al diccionario`
            )}
          >
            Aprobar
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder={sameAs ? "Fusionar con otra…" : "Fusionar con…"}
          aria-label={`Buscar una entrada para fusionar ${keyword.name}`}
          className="h-8 w-full sm:w-56"
          disabled={busy}
        />
        {targets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {targets.map((target) => (
              <Button
                key={target.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                disabled={busy}
                onClick={() => merge(target)}
              >
                Fusionar con {target.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="justify-self-start text-muted-foreground"
        disabled={busy}
        onClick={() => run(blockKeyword(keyword.id), `"${keyword.name}" dejó de contar en las métricas`)}
      >
        Bloquear
      </Button>
    </li>
  );
}
