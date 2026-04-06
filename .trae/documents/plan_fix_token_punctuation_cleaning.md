# Plan — Corrección de puntuación en tokens (`paypal.` vs `node.js`)

## Summary
Aplicar una limpieza determinista de tokens en `src/app/api/parse-cv/route.ts` para eliminar puntuación de borde sin romper puntos internos válidos, de modo que `paypal.` se convierta en `paypal` y `node.js` se mantenga como `node.js`.

## Current State Analysis
- El pipeline tokeniza con regex Unicode y conserva caracteres `+.#-`.
- No existe una etapa explícita de limpieza de puntuación por token después de tokenizar.
- Como resultado, tokens con puntuación final como `paypal.` pueden pasar a filtrado/canonicalización.
- La función de filtrado actual no recorta puntuación de borde; solo descarta por reglas de longitud, dígitos, stopwords y puntuación pura.

## Proposed Changes

### Archivo: `src/app/api/parse-cv/route.ts`

#### 1) Agregar función de limpieza de token
- Crear `cleanToken(token: string): string` con reglas exactas:
  1. Quitar puntuación/espacios al inicio con `replace(/^[\s"'`([{<]+/, '')`
  2. Quitar puntuación/espacios al final con `replace(/[\s"'`)\]}>.,;:!?]+$/, '')`
  3. Normalizar puntos finales repetidos con `replace(/\.{2,}$/, '')`

#### 2) Integrar limpieza en el pipeline
- Mantener el orden del pipeline.
- Aplicar `cleanToken` inmediatamente después de `tokenize` y antes de `filterToken`.
- Flujo en `runKeywordPipeline`:
  1. `tokenized = tokenize(preprocessedText)`
  2. `cleaned = tokenized.map(cleanToken)`
  3. `filtered = cleaned.filter(filterToken)`
  4. Continuar con canonicalización, conteo y deduplicación.

#### 3) Mantener comportamiento determinista existente
- No modificar reglas de frases, spans, canonicalización, conteo ni deduplicación.
- No modificar el contrato de salida `{ text, keywords, keywordCounts }`.
- No modificar `schema.prisma` ni persistencia.

#### 4) Ajustar filtros para trabajar con token limpio
- Confirmar que `filterToken` opere sobre el token ya limpiado.
- Mantener regla numérica global `if /\d/.test(token) => discard` sin cambios.

## Assumptions & Decisions
- Alcance exclusivo: `src/app/api/parse-cv/route.ts`.
- No se cambian estructuras `PHRASE_DICTIONARY`, `STOPWORDS`, `CANONICAL_MAP`.
- No se agregan nuevas categorías, scoring, top N, IA ni optimizaciones de performance.
- El objetivo funcional único es corregir puntuación de borde en tokens.

## Verification Steps
1. Verificar `paypal.` -> `paypal`.
2. Verificar `paypal...` -> `paypal`.
3. Verificar `node.js` -> `node.js`.
4. Verificar `"react"` (con comillas) -> `react`.
5. Verificar que el resto del pipeline mantenga `keywordCounts` y deduplicación determinista.
6. Verificar que no haya errores de TypeScript tras el cambio.
