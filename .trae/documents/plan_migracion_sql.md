# Plan de Migración: Zustand a Esquema SQL

Este plan detalla el análisis de los stores de Zustand actuales y propone un esquema SQL completo (PostgreSQL) para reemplazarlos, consolidando la persistencia de datos en una base de datos relacional.

## 1. Análisis de Stores de Zustand Existentes

Se han identificado 4 stores principales que actualmente persisten en `localStorage`:

### A. `applicationStore.ts` (Aplicaciones)
- **Estado Actual**:
  - `applications`: Lista de objetos `JobApplication`.
  - `pendingApplication`: Objeto temporal para aplicaciones en revisión.
- **Campos Clave**: `id`, `date`, `link`, `jobTitle`, `jobDescription`, `detectedWords` (array string), `positionId`, `provider`.
- **Necesidad SQL**: Tabla de aplicaciones con relación a usuarios, posiciones y palabras clave. Manejo de estado para "pending".

### B. `cvStore.ts` (Currículos)
- **Estado Actual**:
  - `cvs`: Lista de objetos `CV`.
  - `activeCvId`: ID del CV seleccionado por defecto.
- **Campos Clave**: `id`, `name`, `keywords` (array string), `text`, `uploadDate`.
- **Necesidad SQL**: Tabla de CVs. El `activeCvId` se modelará como un booleano `is_primary` en la tabla para asegurar integridad.

### C. `statsStore.ts` (Métricas)
- **Estado Actual**:
  - `providerStats`: Diccionario por proveedor (`generated`, `accepted`, `rejected`).
- **Necesidad SQL**: Tabla de estadísticas agrupada por usuario y proveedor.

### D. `PositionStore.ts` (Posiciones)
- **Estado Actual**:
  - `positions`: Array simple de strings.
- **Necesidad SQL**: Tabla normalizada de posiciones para evitar duplicados y permitir estadísticas futuras.

## 2. Esquema SQL Propuesto (PostgreSQL)

El esquema propuesto se basa en la estructura sólida ya existente en `prisma/schema.prisma`, con ajustes menores para cubrir la funcionalidad de los stores (específicamente estados de borrador y selección de CV).

### Estructura del Esquema

1.  **Usuarios y Autenticación**
    - Tabla `users`: Núcleo de la identidad.
    - Tablas de soporte Auth (si se usa NextAuth): `accounts`, `sessions`.

2.  **Core (Negocio)**
    - Tabla `positions`: Reemplaza el array simple de strings.
    - Tabla `cvs`: Almacena el texto y metadatos. Campo `is_primary` reemplaza `activeCvId`.
    - Tabla `job_applications`: Almacena las postulaciones.
      - **Mejora**: Campo `status` (ENUM: 'DRAFT', 'APPLIED', 'REJECTED') para manejar `pendingApplication`.

3.  **Inteligencia (Keywords)**
    - Tabla `keywords`: Diccionario único de palabras.
    - Tablas pivote (muchos-a-muchos): `cv_keywords`, `job_application_keywords`.
    - Esto reemplaza los arrays de strings `detectedWords` y `keywords`, permitiendo búsquedas SQL eficientes (ej: "traer todas las ofertas con 'React'").

4.  **Métricas**
    - Tabla `provider_stats`: Persistencia directa de contadores.

## 3. Pasos de Implementación

1.  **Generación del DDL**: Crear el script SQL completo (`schema.sql`) con todas las sentencias `CREATE TABLE`, restricciones (`PK`, `FK`, `UNIQUE`) e índices.
2.  **Mapeo de Datos**: Documentar explícitamente qué campo del store va a qué columna SQL.
3.  **Verificación**: Confirmar que no se pierda ningún dato del estado actual (ej: fechas, textos largos).

## 4. Entregable
- Un archivo Markdown o bloque de código con el DDL SQL completo listo para ser ejecutado en PostgreSQL.
