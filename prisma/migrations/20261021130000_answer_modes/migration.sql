-- Respuestas tipo: si se copian tal cual (datos) o Claude las adapta a cada oferta; y de dónde salió cada respuesta enviada.
-- Solo agrega columnas con valor por defecto u opcionales; no toca datos existentes.
ALTER TABLE "AnswerTemplate" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'VERBATIM';
ALTER TABLE "ApplicationAnswer" ADD COLUMN "origin" TEXT;
