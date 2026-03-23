# Plan Arquitectónico: Sistema de Clasificación de Puestos en 4 Niveles

## 1. Visión General del Nuevo Enfoque
Para solucionar la fragmentación de datos y potenciar las capacidades de filtrado (especialmente útil para Recruiters y métricas globales), implementaremos una arquitectura de clasificación en embudo (de lo específico a lo general). 

La jerarquía será:
1. **Título Raw (Extraído por IA):** Mantiene la fidelidad del anuncio original (ej. *"Ninja React Engineer"*).
2. **Alias (PositionAlias):** El puente conector (ej. *"Ninja React Engineer"* = *"Frontend Developer"*).
3. **Puesto Canónico (CanonicalPosition):** El nombre estandarizado del rol (ej. *"Frontend Developer"*).
4. **Sector / Industria (Sector):** La agrupación de alto nivel (ej. *"Tecnología / IT"*).

Se integrará un sistema de **Crowdsourcing y Moderación** donde los usuarios (Hunters) y Recruiters podrán proponer estas agrupaciones, sujetas a la aprobación de un Admin.

---

## 2. Integración con el Modelo Existente (Esquema Prisma)

Actualmente existe un modelo `Position` que pertenece al `Profile` (es decir, las carpetas personales del usuario, sus "Puestos Deseados"). Para no romper la funcionalidad actual del usuario, el sistema global actuará de forma paralela en las `JobApplications`.

### Nuevo Modelo de Datos Propuesto:

```prisma
// ==========================================
// MÓDULO: DICCIONARIO GLOBAL DE PUESTOS
// ==========================================

// 1. Capa Superior: Sector o Industria
model Sector {
  id          String @id @default(cuid())
  name        String @unique // ej: "Tecnología / IT", "Marketing", "Finanzas"
  description String?
  isActive    Boolean @default(true)
  
  positions   CanonicalPosition[]
}

// 2. Capa Media: Puesto Canónico
model CanonicalPosition {
  id          String @id @default(cuid())
  name        String @unique // ej: "Frontend Developer"
  isActive    Boolean @default(true)
  
  // Relación con el Sector
  sectorId    String?
  sector      Sector? @relation(fields: [sectorId], references: [id])
  
  // Relación con las aplicaciones reales
  applications JobApplication[]
  
  // Relación con los alias
  aliases      PositionAlias[]
}

// 3. Capa Inferior: Alias (El mapeo automático)
model PositionAlias {
  id                  String @id @default(cuid())
  aliasText           String @unique // ej: "React Ninja", "UI Engineer"
  
  canonicalPositionId String
  canonicalPosition   CanonicalPosition @relation(fields: [canonicalPositionId], references: [id])
}

// ==========================================
// MÓDULO: CROWDSOURCING Y MODERACIÓN
// ==========================================

enum SuggestionType {
  ALIAS_TO_CANONICAL  // Proponer que "React Ninja" sea "Frontend Developer"
  CANONICAL_TO_SECTOR // Proponer que "Frontend Developer" pertenezca a "Tecnología / IT"
}

enum SuggestionStatus {
  PENDING
  APPROVED
  REJECTED
}

model MappingSuggestion {
  id                  String @id @default(cuid())
  type                SuggestionType
  
  // Campos usados si type == ALIAS_TO_CANONICAL
  rawTitle            String? 
  suggestedCanonicalId String? // ID si sugiere un canónico existente
  proposedNewCanonical String? // Texto si sugiere crear un canónico nuevo
  
  // Campos usados si type == CANONICAL_TO_SECTOR
  targetCanonicalId   String? // El puesto canónico que se quiere categorizar
  suggestedSectorId   String? // ID si sugiere un sector existente
  proposedNewSector   String? // Texto si sugiere crear un sector nuevo

  status              SuggestionStatus @default(PENDING)
  
  userId              String // Usuario o Recruiter que hace la propuesta
  user                User @relation(fields: [userId], references: [id])
  
  createdAt           DateTime @default(now())
}
```

### Cambios en `JobApplication`:
Añadiremos un campo a la postulación real para enlazarla al diccionario global:
```prisma
model JobApplication {
  // ... campos existentes ...
  jobTitle              String // Este sigue siendo el Título Raw
  
  // NUEVO: Enlace al diccionario global
  canonicalPositionId   String?
  canonicalPosition     CanonicalPosition? @relation(fields: [canonicalPositionId], references: [id], onDelete: SetNull)
}
```

---

## 3. Plan de Implementación por Fases

Para que la transición sea fluida y no rompa la experiencia actual (`/user/add-job`), lo dividiremos en 3 fases claras:

### Fase 1: Base de Datos y Mapeo Silencioso (Backend)
1. **Actualizar Prisma:** Aplicar los nuevos modelos (`Sector`, `CanonicalPosition`, `PositionAlias`, `MappingSuggestion`) y ejecutar la migración.
2. **Ajustar la IA en `/user/add-job`:** La IA simplemente devolverá el título exacto de la oferta (`jobTitle`). Ya no forzaremos que elija "Otros" ni que dependa exclusivamente de los Puestos personales del usuario.
3. **Trigger de Auto-Mapeo:** Al guardar la `JobApplication`, el backend buscará si el `jobTitle` existe en `PositionAlias`. Si hay coincidencia, asigna el `canonicalPositionId`. Si no, queda en `null`.

### Fase 2: UI de Crowdsourcing (Frontend - Hunters y Recruiters)
1. **Badge de Estado:** En el Dashboard de aplicaciones, las ofertas sin `canonicalPositionId` mostrarán un indicador (ej. "Sin categorizar").
2. **Modal de Sugerencia (Hunters):** Al hacer clic, el usuario podrá buscar en la lista de Puestos Canónicos existentes o sugerir uno nuevo (creando un `MappingSuggestion` de tipo `ALIAS_TO_CANONICAL`).
3. **Modal de Sectorización (Recruiters):** En una vista de exploración de candidatos (futura), si un Recruiter ve un Puesto Canónico sin Sector, podrá sugerir a qué Sector pertenece (`CANONICAL_TO_SECTOR`).

### Fase 3: Panel de Administración (Backoffice)
1. **Dashboard de Moderación:** Una tabla exclusiva para Admins (en `/admin`) que liste todos los `MappingSuggestion` pendientes.
2. **Acciones de Aprobación:**
   - Si se aprueba un alias hacia un canónico, el sistema crea el `PositionAlias` y actualiza **todas las postulaciones pasadas** que tuvieran ese título raw, asignándoles el `canonicalPositionId`.
   - Si se aprueba un canónico hacia un sector, se actualiza el `CanonicalPosition` con el `sectorId`.

---

## 4. Conclusión y Siguiente Paso
Este diseño cumple perfectamente con tu visión: empodera a la comunidad para mantener la base de datos limpia y categorizada, mientras que los Admins mantienen la calidad de la información. Además, la separación en 4 niveles (Raw -> Alias -> Canónico -> Sector) permitirá construir filtros extremadamente potentes en el futuro.

**Si estás de acuerdo con este plan detallado, el siguiente paso sería salir del Modo Plan y comenzar la Fase 1 (Actualización del esquema Prisma y ajuste de la lógica de guardado de la IA).**