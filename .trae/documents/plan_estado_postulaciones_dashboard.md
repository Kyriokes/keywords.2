## Resumen

Agregar en `/user/dashboard` una forma de editar el estado de cada postulación desde la tabla, mediante un `Select` por fila en una nueva columna **Estado**.\
Los estados visibles serán: **Enviada, Entrevista, Guardada, Rechazada** y se persistirán en base de datos con valores técnicos en inglés.

## Análisis del estado actual

* La vista del dashboard se monta en `src/app/user/dashboard/page.tsx`, y la tabla actual usa `ApplicationsTable`.

* La tabla (`src/components/ApplicationsTable.tsx`) hoy no muestra ni permite editar `status`; solo fecha, título, descripción, enlace y eliminar.

* El store (`src/store/applicationStore.ts`) no incluye el campo `status` en `JobApplication` ni acción para actualizarlo.

* Las server actions (`src/actions/application-actions.ts`) implementan crear/listar/eliminar/limpiar, pero no actualizar estado.

* El modelo Prisma (`prisma/schema.prisma`) ya tiene `JobApplication.status String @default("APPLIED")`, por lo que no se requiere migración para esta mejora.

## Cambios propuestos

### 1) Tipado y contrato de estados

**Archivo:** `src/store/applicationStore.ts`\
**Qué:**

* Extender `JobApplication` con `status`.

* Definir un tipo de estado canónico (por ejemplo: `APPLIED | INTERVIEW | SAVED | REJECTED`).

* Agregar acción `updateApplicationStatus(id, status)` en el store.

**Por qué:**

* El frontend necesita modelar el estado para poder renderizar y actualizarlo de forma tipada.

**Cómo:**

* Ajustar interfaz y estado local.

* Implementar update optimista en el array `applications` tras respuesta exitosa de server action.

### 2) Persistencia backend de cambio de estado

**Archivo:** `src/actions/application-actions.ts`\
**Qué:**

* Agregar nueva server action `updateApplicationStatus`.

* Validar sesión, perfil y ownership de la postulación.

* Validar que el estado recibido pertenezca al set permitido.

* Actualizar `jobApplication.status` y `revalidatePath('/user/dashboard')`.

* Incluir `status` en el mapeo de retorno de `createApplication` y `getApplications`.

**Por qué:**

* Garantiza persistencia real en DB y seguridad de edición por usuario dueño.

**Cómo:**

* Reusar el patrón de autorización ya usado en `deleteApplication`.

* Mantener formato de respuesta alineado con el store.

### 3) Columna Estado con Select en tabla

**Archivo:** `src/components/ApplicationsTable.tsx`\
**Qué:**

* Importar componentes `Select` de UI existente.

* Agregar nueva columna **Estado**.

* Renderizar `Select` por fila con opciones:

  * Enviada → `APPLIED`

  * Entrevista → `INTERVIEW`

  * Guardada → `SAVED`

  * Rechazada → `REJECTED`

* Al cambiar, invocar `updateApplicationStatus` y mostrar feedback (success/error) con `toast`.

**Por qué:**

* Resuelve la necesidad funcional de cambiar estado directamente en la tabla.

**Cómo:**

* Integrar el `Select` siguiendo el patrón de `StatsView`.

* Mantener etiquetas en español y valores persistidos en inglés.

* Preservar resto de columnas y acciones existentes.

### 4) Coherencia de datos iniciales y UX

**Archivos:**

* `src/actions/application-actions.ts`

* `src/components/ApplicationsTable.tsx`

**Qué:**

* Asegurar fallback visual para estados desconocidos (si existieran datos históricos fuera del set).

* Definir comportamiento ante error de actualización (mantener estado anterior + toast de error).

**Por qué:**

* Evita romper la UI por datos legacy y mejora robustez.

**Cómo:**

* Map de etiquetas central en el componente (o constante local del módulo).

* Guardas antes de enviar la actualización.

## Supuestos y decisiones cerradas

* Se agrega **Rechazada** además de los tres estados de la landing.

* Persistencia en DB con valores técnicos en inglés.

* El selector se muestra en una **nueva columna Estado**.

* No se modifica el esquema Prisma porque el campo `status` ya existe.

## Verificación

1. Ejecutar chequeo de tipos/lint para validar que nuevos tipos/acciones no rompen compilación.
2. Validar flujo funcional en `/user/dashboard`:

   * Cargar tabla con estados existentes.

   * Cambiar estado en varias filas y confirmar persistencia tras refrescar.

   * Verificar toast de éxito y manejo de error.
3. Confirmar que crear/eliminar postulaciones sigue funcionando y que `status` llega correctamente en los datos listados.
4. Verificar que no se altera el comportamiento de búsqueda, orden y paginación de la tabla.

