# Especificación Formal — Pipeline de Keywords 100% Determinista

## 1) Entrada y salida

### Input

* `text: string` (texto plano ya extraído del CV).

### Output

* Objeto exacto:

```ts
{
  text: string,
  keywords: string[],
  keywordCounts: Record<string, number>
}
```

## 2) Estructuras obligatorias

* `PHRASE_DICTIONARY: string[]`

* `STOPWORDS: Set<string>`

* `CANONICAL_MAP: Record<string, string>`

## 3) Orden fijo e inmutable del pipeline

1. Normalizar
2. Preprocesar frases
3. Tokenizar
4. Filtrar
5. Canonicalizar
6. Contar ocurrencias
7. Deduplicar

## 4) Reglas formales por etapa

### 4.1 Normalizar

Aplicar en este orden exacto:

1. `text = text.normalize("NFKC")`
2. Eliminar diacríticos
3. `text = text.toLowerCase()`
4. Limpiar caracteres con regex exacta: `text = text.replace(/[^\p{L}\p{N}\s+.#-]/gu, " ")`
5. Colapsar espacios con regex exacta: `text = text.replace(/\s+/g, " ").trim()`

### 4.2 Preprocesar frases

Reglas exactas:

1. Detectar frases por matching exacto sobre texto normalizado.
2. Delimitar por palabra con regex base: `(^|\s)PHRASE(?=\s|$)`.
3. Ordenar frases por longitud descendente de caracteres.
4. Desempate por orden lexicográfico ascendente.
5. Evaluar en ese orden.
6. Registrar spans con índices absolutos `{ start: number, end: number }`.
7. Bloquear solapamiento: rechazar cualquier match cuyo rango interseque un span ya aceptado.
8. Reemplazar cada span aceptado por la frase exacta del diccionario.

### 4.3 Tokenizar

Reglas exactas:

1. Ejecutar sobre el texto resultante de 4.2.
2. Usar regex exacta de token: `/[\p{L}\p{N}][\p{L}\p{N}+.#-]*/gu`.
3. Separar puntuación por exclusión: cualquier carácter fuera del patrón no integra token.
4. Token válido inicial: todo match no vacío de la regex.

### 4.4 Filtrar

Aplicar por token en este orden:

1. Si `token.length === 0` => descartar.
2. Si `/\d/.test(token)` => descartar.
3. Si `STOPWORDS.has(token)` => descartar.
4. Si `token.length < 3` => descartar.
5. Si `/^[+#.-]+$/.test(token)` => descartar.
6. Si ninguna condición aplica => conservar.

### 4.5 Canonicalizar

Aplicar por token conservado:

1. Buscar clave exacta en `CANONICAL_MAP`.
2. Si existe clave exacta: usar `CANONICAL_MAP[token]`.
3. Si no existe clave exacta: usar `token`.
4. Prohibido fuzzy matching.
5. Prohibido fallback heurístico.

### 4.6 Contar ocurrencias

Reglas exactas:

1. Calcular sobre la secuencia canonicalizada completa.
2. Estructura exacta: `keywordCounts: Record<string, number>`.
3. Iterar secuencialmente de izquierda a derecha.
4. Por cada `k`:

   * si `keywordCounts[k]` no existe, asignar `1`

   * si `keywordCounts[k]` existe, incrementar `+1`

### 4.7 Deduplicar

Reglas exactas:

1. Ejecutar después de 4.6.
2. Algoritmo exacto: `Set<string>` en orden de inserción.
3. Recorrer la secuencia canonicalizada de izquierda a derecha.
4. Insertar cada keyword en `Set`.
5. Resultado final `keywords` = `Array.from(set)` en ese orden.
6. Criterio de orden final: índice de primera aparición.

## 5) Restricciones de alcance

* Modificar solamente `src/app/api/parse-cv/route.ts`.

* Mantener flujo actual de persistencia.

* No modificar `schema.prisma`.

* No agregar categorías.

* No agregar top N.

* No agregar scoring.

* No agregar IA.

* No agregar optimizaciones de performance.

## 6) Verificación programática obligatoria

1. Mismo `text` de entrada produce exactamente el mismo `keywords` y `keywordCounts`.
2. Cualquier token con dígitos se descarta por la regla `/\d/.test(token)`.
3. Ningún span de frase aceptada se solapa con otro span aceptado.
4. `keywordCounts` refleja la secuencia canonicalizada con repeticiones.
5. `keywords` refleja deduplicación por primera aparición.

