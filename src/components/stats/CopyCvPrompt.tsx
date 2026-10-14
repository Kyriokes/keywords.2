"use client";

import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildCvPrompt } from "@/lib/stats/cvPrompt";
import type { KeywordSummary } from "@/lib/stats/keywordAnalysis";
import { isBoolean, usePersistentState } from "@/lib/usePersistentState";

interface CopyCvPromptProps {
  summary: KeywordSummary;
  roles: string[];
  levels: string[];
  /** Texto del CV activo; vacío si no hay CV. */
  cvText: string;
}

/**
 * Copia un pedido listo para pegar en un chat de IA, con lo que muestra la pantalla.
 * La app no reescribe el CV: le pasa el contexto a un modelo más potente que elige el usuario.
 */
export function CopyCvPrompt({ summary, roles, levels, cvText }: CopyCvPromptProps) {
  const [includeCv, setIncludeCv] = usePersistentState("keywords:stats:prompt-cv", true, isBoolean);
  // Si el navegador no deja escribir en el portapapeles, el texto se muestra para copiarlo a mano
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const hasCv = cvText.trim().length > 0;

  const copy = async () => {
    const prompt = buildCvPrompt({ summary, roles, levels, cvText, includeCv });
    try {
      await navigator.clipboard.writeText(prompt);
      setManualCopy(null);
      toast.success("Copiado. Pegalo en el chat de IA que uses.");
    } catch {
      setManualCopy(prompt);
    }
  };

  return (
    <section aria-labelledby="cv-prompt-title" className="space-y-3 rounded-lg border p-5">
      <div className="space-y-1">
        <h3 id="cv-prompt-title" className="text-lg font-semibold">
          {hasCv ? "Mejorá tu CV con una IA" : "Armá tu CV con una IA"}
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Copiá un pedido con lo que muestra esta pantalla y pegalo en ChatGPT, Claude o Gemini. Le pide que no
          invente experiencia y que te pregunte antes de sumar algo. Nada sale de KeyWords hasta que lo pegues.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="button" size="sm" onClick={copy}>
          <ClipboardCopy aria-hidden />
          {hasCv ? "Copiar para mejorar mi CV con IA" : "Copiar para armar mi CV con IA"}
        </Button>
        {hasCv && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={includeCv}
              onChange={(event) => setIncludeCv(event.target.checked)}
            />
            Incluir el texto de mi CV
          </label>
        )}
      </div>

      {manualCopy && (
        <div className="space-y-2">
          <p className="text-sm" role="status">
            Tu navegador no dejó copiar. Seleccioná el texto y copialo a mano.
          </p>
          <Textarea
            readOnly
            value={manualCopy}
            onFocus={(event) => event.currentTarget.select()}
            className="h-48 font-mono text-xs"
            aria-label="Pedido para la IA"
          />
        </div>
      )}
    </section>
  );
}
