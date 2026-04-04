# Diagnóstico de situación del proyecto

Fecha: 2026-03-25  
Repositorio: `G:/No-Henry/KeyWords/V2`

## 1) Resumen ejecutivo

El proyecto tiene una base funcional sólida (Next.js + Prisma + Auth.js + capa IA multiproveedor) y un dominio de negocio bien modelado en base de datos. La arquitectura actual permite escalar funcionalidades de matching laboral, reclutamiento y economía interna.

El riesgo principal hoy no está en la idea ni en el stack, sino en la **confiabilidad operativa y seguridad aplicada**: no hay tests automatizados, hay logging sensible en auth/proxy, y endpoints de tipo debug/admin dependen de protección implícita por ruta sin validación de rol dentro del handler.

Prioridades inmediatas:
- Blindar seguridad/logs (P0-P1).
- Introducir una base mínima de testing y CI (P1).
- Reducir deuda estructural en capa de proveedores IA y tipado (P2).

## 2) Inventario técnico actual

### Stack y arquitectura
- Frontend/Fullstack: Next.js App Router + React + TypeScript (`package.json`).
- Persistencia: PostgreSQL + Prisma (`prisma/schema.prisma`).
- Auth/RBAC: NextAuth v5 beta (`src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/routes.config.ts`).
- IA multiproveedor: controlador y manager centralizados (`src/lib/ia/controller.ts`, `src/lib/ia/providerManager.ts`, `src/lib/ia/providers/*`).
- Estado cliente: Zustand (`src/store/*`).
- Parsing de CV: `pdf2json` + `mammoth` (`src/app/api/parse-cv/route.ts`).

### Operación y calidad de ingeniería
- Lint disponible: `eslint` (`eslint.config.mjs`, script `lint`).
- Build: `prisma generate && next build` (`package.json`).
- Sin evidencia de pipeline CI (`.github/workflows/*` inexistente).
- Sin `.env.example`.
- Sin Dockerfile ni compose.
- Sin suite de testing automatizada (no scripts/dependencias de test ni archivos `*.test|*.spec`).

## 3) Diagnóstico técnico por dimensiones

### 3.1 Arquitectura y modularidad
**Estado:** Bueno en separación por dominios (`src/actions`, `src/lib`, `src/app/api`, `prisma`), con modelo de datos robusto y extensible.

**Fortalezas**
- Modelo relacional rico para negocio y analítica (`prisma/schema.prisma`).
- Capa IA centralizada que desacopla proveedores (`src/lib/ia/*`).

**Riesgos**
- Alta repetición entre implementaciones de proveedores IA (`src/lib/ia/providers/*`), elevando costo de mantenimiento y divergencia de comportamiento.

### 3.2 Calidad de código y tipado
**Estado:** Medio.

**Fortalezas**
- `strict: true` en TypeScript (`tsconfig.json`).

**Riesgos**
- `allowJs: true` y `skipLibCheck: true` en `tsconfig.json` reducen rigor global.
- Uso de `any` en rutas/acciones críticas (por ejemplo en `src/app/api/parse-cv/route.ts`, `src/lib/ia/providerManager.ts`).

### 3.3 Testing y confiabilidad
**Estado:** Bajo.

**Hallazgo**
- No hay framework ni casos de test automatizados (`package.json` sin `test`, sin archivos test/spec en el repo).

**Impacto**
- Mayor probabilidad de regresiones en auth, parsing de CV, acciones server y flujo IA.

### 3.4 Seguridad y exposición operativa
**Estado:** Riesgo alto focalizado.

**Hallazgos**
- Logging sensible en callbacks de auth (`src/auth.config.ts`) mostrando datos de usuario/token/sesión.
- Logging detallado de decisiones de autorización en proxy (`src/proxy.ts`).
- Rutas admin/debug sin guard de rol explícito dentro del handler:
  - `src/app/api/debug/providers/route.ts`
  - `src/app/api/admin/ping/route.ts`
  Actualmente dependen del proxy y convenciones de ruta.
- Parseo de archivos sin límite explícito de tamaño/rate en `src/app/api/parse-cv/route.ts`.

### 3.5 Datos y consistencia
**Estado:** Bueno.

**Fortalezas**
- Esquema Prisma con entidades y relaciones claras, índices y unicidad relevantes.
- Estructura preparada para evolución (módulos de métricas, diccionario canónico, economía y quests).

### 3.6 Operación / DevEx
**Estado:** Medio-bajo.

**Hallazgos**
- Faltan artefactos de estandarización operativa: CI, `.env.example`, estrategia de despliegue codificada.
- Hay README con setup manual, pero onboarding depende de conocimiento implícito.

## 4) Matriz de hallazgos priorizados (P0-P3)

| Prioridad | Hallazgo | Evidencia | Riesgo | Acción recomendada |
|---|---|---|---|---|
| P0 | Logging sensible en autenticación | `src/auth.config.ts` | Exposición de datos sensibles en logs | Eliminar payloads completos; usar logging mínimo y redactado |
| P1 | Endpoints admin/debug sin guard de rol in-handler | `src/app/api/debug/providers/route.ts`, `src/app/api/admin/ping/route.ts` | Bypass por cambios de routing/proxy o ejecución no prevista | Validar `auth()` + rol `ADMIN` dentro de cada handler |
| P1 | Ausencia de tests automatizados | `package.json`, búsqueda repo | Regresiones silenciosas y menor confianza en releases | Implementar smoke tests para auth/api/actions críticas |
| P1 | Sin CI pipeline | ausencia `.github/workflows/*` | Calidad no bloqueante previo a merge/deploy | Crear CI mínimo: lint + typecheck + build + prisma generate |
| P2 | Repetición en proveedores IA | `src/lib/ia/providers/*` | Deuda de mantenimiento y inconsistencias entre providers | Extraer clase base/utilidades compartidas |
| P2 | Tipado relajado en puntos críticos | `tsconfig.json`, uso de `any` | Menor detección temprana de errores | Reducir `any`, añadir tipos explícitos y validaciones |
| P2 | Parse CV sin límites explícitos | `src/app/api/parse-cv/route.ts` | Riesgo de consumo excesivo de recursos/costos | Limitar tamaño de archivo, timeout y rate limiting |
| P3 | Sin `.env.example` ni guía operativa formalizada | ausencia `.env.example` | Onboarding más lento y errores de configuración | Añadir `.env.example` y checklist operativa |
| P3 | Sin estrategia de contenedorización/documentación de despliegue | ausencia Docker files | Variabilidad entre entornos | Definir Docker o estandarizar deploy sin Docker |

## 5) Plan de remediación por fases

### Fase 1 (1-2 semanas) - Contención de riesgo
1. Reducir logs sensibles en auth/proxy.
2. Añadir validación de rol en handlers admin/debug.
3. Definir límites en upload/parse CV.
4. Crear `.env.example`.
5. Montar CI básico en GitHub Actions.

### Fase 2 (2-4 semanas) - Confiabilidad
1. Introducir framework de tests (Vitest/Jest) y smoke suite.
2. Cubrir auth, proxy, rutas API críticas y acciones de negocio.
3. Agregar pruebas de error paths (proveedores no disponibles, payloads inválidos).

### Fase 3 (4-8 semanas) - Mantenibilidad
1. Refactor de capa de proveedores IA para eliminar duplicación.
2. Endurecer tipado (`any` -> tipos concretos, validación de contratos).
3. Definir estándares de formato (Prettier/Biome) y convención de contribución.

## 6) Backlog recomendado (acciones concretas)

1. Crear `SEC-01`: sanitización de logs en auth/proxy.
2. Crear `SEC-02`: guards de rol en handlers admin/debug.
3. Crear `API-01`: límite de tamaño y control de abuso en parseo de CV.
4. Crear `QA-01`: bootstrap de testing + 10 tests críticos iniciales.
5. Crear `OPS-01`: workflow CI (lint, typecheck, build).
6. Crear `DX-01`: `.env.example` + guía de arranque reproducible.
7. Crear `ARCH-01`: base provider abstracta y utilidades comunes IA.

## 7) Conclusión

El proyecto está bien encaminado en términos de producto y arquitectura base. La brecha principal para escalar con seguridad está en disciplina operativa (tests/CI) y hardening de seguridad aplicado en puntos críticos. Con una intervención de 2-4 semanas enfocada en P0-P1, se puede elevar de forma notable la confiabilidad y reducir riesgo de incidentes.
