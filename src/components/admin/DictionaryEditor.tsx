"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  searchDictionaryEntries,
  unblockKeyword,
  updateKeyword,
  type DictionaryEntry,
} from "@/actions/dictionary-actions";
import { CATEGORY_LABELS, KEYWORD_CATEGORIES, type KeywordCategory } from "@/lib/keywords/categories";

export function DictionaryEditor() {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [searched, setSearched] = useState(false);
  // Si el usuario sigue escribiendo, solo cuenta la respuesta de la última búsqueda
  const latestSearch = useRef(0);

  const search = async (value: string) => {
    setQuery(value);
    const searchId = ++latestSearch.current;
    try {
      const results = await searchDictionaryEntries(value);
      if (searchId !== latestSearch.current) return;
      setEntries(results);
      setSearched(value.trim().length >= 2);
    } catch {
      if (searchId === latestSearch.current) toast.error("No se pudo buscar en el diccionario.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entradas del diccionario</CardTitle>
        <CardDescription>
          Buscá una entrada para cambiarle el nombre o la categoría, o para desbloquear un término.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="search"
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Buscar por nombre o alias"
          aria-label="Buscar entradas del diccionario"
          className="max-w-sm"
        />

        {entries.length > 0 ? (
          <ul className="divide-y border-y">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onChanged={() => search(query)} />
            ))}
          </ul>
        ) : (
          searched && <p className="text-sm text-muted-foreground">Ninguna entrada coincide con esa búsqueda.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function EntryRow({ entry, onChanged }: { entry: DictionaryEntry; onChanged: () => void }) {
  const [name, setName] = useState(entry.name);
  const [category, setCategory] = useState<KeywordCategory>(entry.category);
  const [busy, setBusy] = useState(false);

  const hasChanges = name.trim() !== entry.name || category !== entry.category;

  const run = async (action: ReturnType<typeof updateKeyword>, done: string) => {
    setBusy(true);
    try {
      const result = await action;
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(done);
      onChanged();
    } catch {
      toast.error("No se pudo guardar el cambio.");
    } finally {
      setBusy(false);
    }
  };

  const usage = `${entry.applications === 1 ? "La pide 1 postulación" : `La piden ${entry.applications} postulaciones`}, ${
    entry.aliases === 1 ? "1 alias" : `${entry.aliases} alias`
  }`;

  if (entry.blocked) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <span className="truncate">{entry.name}</span>
            <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">Bloqueada</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{usage}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(unblockKeyword(entry.id), `${entry.name} vuelve a contar en las métricas`)}
        >
          Desbloquear
        </Button>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={`Nombre visible de ${entry.name}`}
          className="h-8 w-56"
          disabled={busy}
        />
        <Select value={category} onValueChange={(value) => setCategory(value as KeywordCategory)} disabled={busy}>
          <SelectTrigger className="h-8 w-52" aria-label={`Categoría de ${entry.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KEYWORD_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{usage}</span>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={busy || !hasChanges || !name.trim()}
        onClick={() => run(updateKeyword({ id: entry.id, displayName: name, category }), `${name.trim()} se actualizó`)}
      >
        Guardar
      </Button>
    </li>
  );
}
