# Plan UX/UI — Controles masivos en tablas de Keywords

## Resumen
- Objetivo: mejorar la experiencia en las tablas **“Las que tenés”** y **“Las que no”** para permitir acciones masivas claras sobre visibilidad de habilidades.
- Propuesta UX recomendada: agregar una **barra de acciones por tabla** con `Seleccionar visibles`, `Ocultar visibles`, `Reiniciar tabla` y una acción global `Reiniciar todo`.
- Resultado esperado: menor fricción para ajustar rápidamente el cálculo de alineación y feedback visual consistente con el estado de cada tabla.

## Análisis del estado actual
- Archivo principal afectado: `src/components/StatsView.tsx`.
- Estado actual:
  - Cada fila tiene control individual de ojo (`Eye`/`EyeOff`) que altera `hiddenKeywordNames`.
  - Existe paginado independiente por tabla con `rowsPerPage` compartido.
  - El cálculo de alineación usa `visibleKeywordStats` (excluye keywords ocultas manualmente).
- Problema UX actual:
  - Operar una gran cantidad de filas exige muchos clics individuales.
  - No hay acción rápida por tabla para escenarios comunes (ocultar todo lo visible, restaurar defaults).
  - Falta jerarquía clara entre acciones locales (por tabla) y globales (ambas tablas).

## Propuesta de cambios

### 1) Toolbar por tabla (acción local)
- **Archivo:** `src/components/StatsView.tsx`
- **Qué:**
  - Agregar debajo del título de cada tabla una fila compacta de acciones:
    - `Seleccionar visibles` (muestra/activa todos los ítems de la página actual o tabla según decisión).
    - `Ocultar visibles` (oculta los ítems del alcance elegido).
    - `Reiniciar tabla` (vuelve al estado default de esa tabla).
  - Mostrar contador contextual: `Ocultas: X / Total: Y`.
- **Por qué:**
  - Reduce clics repetitivos.
  - Hace explícito el estado y el impacto de las acciones.
- **Cómo (recomendado):**
  - Implementar sobre `normalizedName` para mantener estabilidad entre páginas.
  - Acciones aplicadas al **conjunto completo filtrado de la tabla** (no sólo página), para comportamiento consistente y predecible.

### 2) Acción global de reset
- **Archivo:** `src/components/StatsView.tsx`
- **Qué:**
  - Agregar control `Reiniciar todo` en el bloque superior de análisis (junto a filtros), que limpie `hiddenKeywordNames`.
- **Por qué:**
  - Permite volver al baseline rápidamente tras múltiples pruebas.
- **Cómo:**
  - `setHiddenKeywordNames([])`.
  - Mantener filtros de CV/puestos y paginación sin reset (sólo reset de visibilidad).

### 3) Reglas de comportamiento UX (decisiones de producto)
- **Archivo:** `src/components/StatsView.tsx`
- **Qué/Decisión:**
  - `Seleccionar visibles` = remover de `hiddenKeywordNames` las keywords del scope.
  - `Ocultar visibles` = agregar a `hiddenKeywordNames` las keywords del scope.
  - `Reiniciar tabla` = dejar visibles sólo la tabla objetivo y no tocar la otra tabla.
  - `Reiniciar todo` = limpiar ocultas de ambas tablas.
- **Por qué:**
  - Evita sorpresas al usuario y separa claramente alcance local vs global.

### 4) Microcopy y consistencia visual
- **Archivo:** `src/components/StatsView.tsx`
- **Qué:**
  - Etiquetas compactas y consistentes:
    - `Mostrar todo`
    - `Ocultar todo`
    - `Reiniciar tabla`
    - `Reiniciar todo`
  - Botones secundarios (`outline`) y estado deshabilitado cuando acción no aplica.
- **Por qué:**
  - Mejora legibilidad y reduce ruido visual en una zona ya densa.

## Supuestos y decisiones
- Se mantiene el modelo actual de cálculo: alineación basada en `visibleKeywordStats`.
- El estado de ocultas se mantiene durante cambios de página y se recorta cuando cambia el dataset (guard actual de efecto).
- `rowsPerPage` y paginado no se alteran funcionalmente; sólo se agregan controles masivos de visibilidad.
- No se introduce persistencia en backend/localStorage en esta iteración (estado sólo en sesión de componente).

## Verificación
- Verificación funcional manual en dashboard:
  - `Ocultar todo` en “Las que no” reduce alineación según corresponda.
  - `Mostrar todo` revierte impacto.
  - `Reiniciar tabla` sólo afecta una tabla.
  - `Reiniciar todo` restaura baseline global.
  - Cambio de página mantiene coherencia del estado oculto.
- Verificación visual:
  - Toolbar visible y alineada en ambas tablas.
  - Estados disabled correctos cuando no hay cambios aplicables.
- Verificación técnica:
  - Ejecutar diagnóstico TypeScript/React sin errores nuevos.
  - Confirmar que no reaparece `Maximum update depth exceeded`.

