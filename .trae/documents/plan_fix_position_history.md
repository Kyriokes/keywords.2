# Plan de Solución: Denormalización de Posiciones en JobApplication

Este plan aborda el problema de integridad histórica cuando un usuario elimina una `Position` que estaba vinculada a una `JobApplication` existente.

## Análisis del Problema
- **Estado Actual:** `JobApplication` tiene una FK `positionId` hacia `Position` con `onDelete: SetNull`.
- **Riesgo:** Si el usuario borra la posición "Backend", todas sus aplicaciones pasadas clasificadas como "Backend" pierden esa etiqueta (quedan con `positionId: null`).
- **Objetivo:** Preservar el dato histórico de clasificación ("snapshot") independientemente de si la posición original sigue existiendo o no.

## Estrategia de Solución: Snapshotting
Implementaremos un patrón de denormalización agregando un campo de texto que guarde el título de la posición en el momento de la creación.

### 1. Modificación del Schema (Prisma)
Modificar el modelo `JobApplication` en `prisma/schema.prisma`:

```prisma
model JobApplication {
  // ... campos existentes ...
  
  // Relación con una posición deseada (Dinámica, puede cambiar o borrarse)
  positionId      String?
  position        Position? @relation(fields: [positionId], references: [id], onDelete: SetNull)

  // NUEVO CAMPO: Snapshot histórico (Estático, preserva el valor original)
  originalPositionTitle String?  // Ej: "Backend Developer"

  // ...
}
```

### 2. Migración de Datos (SQL)
Al aplicar este cambio, necesitamos poblar el nuevo campo `originalPositionTitle` con los datos existentes para no tener inconsistencias en registros viejos.
- Crear una migración que ejecute un script SQL:
  ```sql
  UPDATE "JobApplication"
  SET "originalPositionTitle" = "Position"."title"
  FROM "Position"
  WHERE "JobApplication"."positionId" = "Position"."id";
  ```

### 3. Actualización de Lógica de Negocio
Adaptar el flujo de creación de aplicaciones (`add-job/page.tsx` y stores) para guardar ambos datos.

**Flujo de Creación:**
1.  El usuario (o la IA) selecciona una posición.
2.  Se guarda el `positionId` (para la relación relacional).
3.  Se guarda el `originalPositionTitle` con el nombre de esa posición (para el historial).

**Flujo de Lectura (UI):**
- Al mostrar la lista de aplicaciones, la lógica de visualización debe ser:
  `const displayTitle = application.position?.title || application.originalPositionTitle || "Sin Clasificar"`
- Esto asegura que si la relación existe, se usa (permitiendo renombrados si implementáramos edición de posiciones), pero si se borró, se usa el snapshot.

## Pasos de Ejecución
1.  [ ] **Schema:** Agregar `originalPositionTitle` a `JobApplication` en `schema.prisma`.
2.  [ ] **Migración:** Ejecutar `prisma migrate dev --name add_historical_position_title` para aplicar el cambio.
3.  [ ] **Lógica (Frontend/Store):** Actualizar `applicationStore` o el Server Action de creación (cuando lo hagamos en la Fase 4) para incluir este campo.
    *   *Nota:* Como aún no hemos migrado `JobApplication` a Server Actions (eso es Fase 4), por ahora solo prepararemos el schema. La lógica se implementará cuando conectemos esa parte.

## Verificación
- Crear una posición "Test".
- Crear una aplicación vinculada a "Test".
- Verificar en DB que `originalPositionTitle` sea "Test".
- Borrar la posición "Test".
- Verificar que la aplicación tiene `positionId: null` pero `originalPositionTitle: "Test"`.
