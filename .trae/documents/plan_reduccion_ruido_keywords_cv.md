# Plan — Fase 1: descarte por patrones de ruido personal en CV (qué ya existe vs qué se agrega)

## Summary

Aplicar una primera fase acotada en `src/app/api/parse-cv/route.ts` para reducir ruido personal usando `PERSONAL_DATA_STOPWORDS` semántico y descarte por patrones, sin tocar persistencia ni esquema.

## Current State Analysis

### Ya existe

* Pipeline activo con etapas de normalización, tokenización, filtrado, canonicalización, conteo y deduplicación.

* Función `cleanToken` previa al filtrado.

* `STOPWORDS` general bilingüe.

* Regla numérica global en `filterToken`: descarte por `/\d/`.

* Salida estable del parser: `text`, `keywords`, `keywordCounts`.

### Falta

* Lista específica para datos personales semánticos.

* Función de descarte por patrones de contacto/URL/email/dirección.

* Orden explícito en `filterToken` separando filtros actuales y nuevos.

## Proposed Changes

### Archivo: `src/app/api/parse-cv/route.ts`

#### 1) `PERSONAL_DATA_STOPWORDS`

##### Ya existe

* `STOPWORDS` general.

##### Se agrega

* Nuevo conjunto `PERSONAL_DATA_STOPWORDS` separado de `STOPWORDS`.

* Contenido de etiquetas semánticas, no nombres propios:

  * identidad: `nombre`, `apellido`, `name`, `surname`

  * contacto: `email`, `correo`, `telefono`, `phone`, `contacto`, `contact`

  * ubicación: `direccion`, `address`, `ciudad`, `city`, `pais`, `country`

  * metadatos de CV: `cv`, `curriculum`, `linkedin`, `portfolio`

#### 2) Descarte por patrones (`isPersonalDataPattern`)

##### Ya existe

* No existe función específica de patrones personales.

##### Se agrega

* Nueva función `isPersonalDataPattern(token: string): boolean`.

* Patrones de descarte:

  * correo: `@`, `gmail`, `hotmail`, `outlook`, `yahoo`

  * web: `http`, `https`, `www`, `.com`, `.net`, `.org`, `.io`, `.dev`

  * contacto/identificador: secuencias de 6+ dígitos

  * dirección abreviada: `cp`, `zip`, `av`, `calle`, `street`, `st`

#### 3) Orden exacto de `filterToken`

##### Ya existe

* validación de vacío

* regla numérica `/\d/`

* `STOPWORDS`

* longitud mínima y puntuación pura

##### Se agrega

* evaluación de `PERSONAL_DATA_STOPWORDS`

* evaluación de `isPersonalDataPattern`

##### Orden final (resultado)

1. token limpio recibido desde `cleanToken`
2. descartar vacío
3. descartar por `/\d/`
4. descartar por `PERSONAL_DATA_STOPWORDS`
5. descartar por `isPersonalDataPattern`
6. descartar por `STOPWORDS`
7. descartar por longitud mínima/puntuación pura
8. conservar

#### 4) Alcance de esta fase

##### Ya existe

* contrato de salida y persistencia actual.

##### Se mantiene sin cambios

* no tocar `schema.prisma`

* no tocar flujo de guardado

* no agregar allowlist técnica nueva

* no agregar filtro por frecuencia

* no agregar IA/performance tuning

## Assumptions & Decisions

* No se usa catálogo de nombres propios.

* Control de ruido personal por semántica + patrón.

* Alcance único: `src/app/api/parse-cv/route.ts`.

## Verification Steps

### Validar existente que debe seguir igual

1. misma salida estructural (`text`, `keywords`, `keywordCounts`)
2. mismo comportamiento determinista para mismo input
3. skills técnicas conocidas continúan (`node.js`, `react`, `postgresql`)

### Validar agregado en esta fase

1. se descartan tokens de correo/dominio (`gmail`, `hotmail`, `www`, `.com`)
2. se descartan tokens de contacto con 6+ dígitos
3. se descartan tokens de etiquetas personales (`nombre`, `email`, `direccion`, `city`)
4. disminuye ruido personal en lista final de `keywords`

