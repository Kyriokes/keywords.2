# Plan de Corrección Integral de Errores TypeScript ("Implicit Any")

## Resumen
El objetivo es eliminar los errores de compilación relacionados con tipos implícitos (`implicit any`) en todo el proyecto, manteniendo la configuración estricta de TypeScript (`strict: true`). El usuario ha elegido la estrategia de **"Corregir Todo (Lento)"**, lo que implica tipar explícitamente las variables y parámetros en lugar de relajar las reglas del compilador.

## Análisis del Estado Actual
- El proyecto tiene `strict: true` en `tsconfig.json`.
- Vercel falla el build cada vez que encuentra un nuevo error de tipo, deteniendo el despliegue.
- Se han identificado varios archivos con problemas recurrentes en `map` functions y callbacks de Prisma, donde el compilador no puede inferir el tipo del argumento.
- Archivos problemáticos recientes: `src/actions/application-actions.ts`, `src/actions/cv-actions.ts`, `src/actions/position-actions.ts`.
- Es probable que existan más errores latentes en componentes de UI y utilidades que aún no han sido reportados por el build incremental.

## Estrategia de Ejecución
Realizaremos un barrido sistemático por capas para asegurar que no queden cabos sueltos.

### Fase 1: Capa de Datos (Server Actions & Libs)
Estas funciones son las que más problemas han dado recientemente.
- Revisar `src/actions/*.ts` para asegurar que todos los `.map()` y callbacks tengan tipos explícitos.
- Revisar `src/lib/ia/*.ts` y helpers para asegurar tipos de retorno y parámetros.

### Fase 2: Stores (Zustand)
- Revisar `src/store/*.ts` para asegurar que las interfaces de estado coincidan con los datos reales.

### Fase 3: Componentes de UI (Components)
- Revisar componentes complejos como `ApplicationsTable.tsx`, `StatsView.tsx`, `LoadSaveDropzone.tsx`.
- Asegurar que las props de los componentes estén bien definidas.

### Fase 4: Verificación Local
- Ejecutar `tsc --noEmit` localmente para detectar **TODOS** los errores de una sola vez, en lugar de esperar a que Vercel falle uno por uno.

## Cambios Propuestos (Ejemplos)

1. **Server Actions (`src/actions/*.ts`)**
   - En lugar de `profile.applications.map(app => ...)`
   - Usar `profile.applications.map((app: any) => ...)` o importar el tipo generado por Prisma si es posible (e.g., `JobApplication & { keywords: ... }`).
   - *Nota:* Dado que Prisma genera tipos complejos con `include`, a veces es más pragmático usar `any` en el map interno si la inferencia es muy profunda, o crear un tipo auxiliar. El usuario ha aceptado correcciones puntuales, pero intentaremos ser lo más estrictos posible donde sea viable, y usar `any` explícito donde la complejidad de Prisma lo haga impráctico para no bloquearnos eternamente.

2. **Helpers (`src/lib/ia/helpers/*.ts`)**
   - Asegurar que `tryParseJsonFromText` tenga un tipo de retorno más seguro que `any` si es posible, o mantener `any` explícito.

## Pasos de Verificación
1. Ejecutar el comando de diagnóstico: `npx tsc --noEmit`
2. Corregir todos los errores reportados por este comando.
3. Solo cuando `tsc --noEmit` salga limpio (exit code 0), procederemos a hacer commit y push.

## Suposiciones
- Asumimos que el usuario prefiere que el código compile a que sea "perfectamente" tipado con genéricos complejos si eso ahorra tiempo, siempre y cuando no sea `implicit any`.
- Usaremos `any` explícito (`(variable: any)`) como solución de compromiso para estructuras de Prisma profundamente anidadas que son difíciles de tipar manualmente sin generar código boilerplate excesivo.

## Plan de Acción Inmediato
1. Ejecutar `npx tsc --noEmit` para obtener la lista completa de errores actuales.
2. Crear una lista de tareas (Todo) basada en los errores encontrados.
3. Ir archivo por archivo corrigiendo los errores.
4. Verificar nuevamente con `tsc`.
5. Notificar al usuario y desplegar.