# Plan de Recuperación: Sistema de Clasificación de Puestos (4 Capas)

## 1. Análisis del Problema Actual

He investigado qué sucedió con el código. El problema ocurrió debido a un error en el manejo del control de versiones durante la sesión anterior:
1. Habíamos implementado exitosamente el esquema de 4 capas (Sector -> CanonicalPosition -> PositionAlias -> MappingSuggestion) en la migración `20260319194842_add_4_layer_positions`.
2. Luego, al intentar implementar el esquema de Economía Premium, hubo un problema de conexión con la base de datos Neon.
3. Para intentar "limpiar" el estado, se ejecutó el comando `git restore prisma/schema.prisma`.
4. Este comando **revirtió el archivo a su estado en el último commit**, borrando todo el código del diccionario global de puestos (que aún no había sido commiteado).
5. Posteriormente, cuando se forzó el push del esquema de economía (`npx prisma db push --accept-data-loss`), Prisma detectó que esos modelos ya no estaban en el archivo y **los eliminó de la base de datos**.

## 2. Objetivo del Plan

El objetivo es **reintegrar** el Módulo de Diccionario Global de Puestos y Moderación al archivo `schema.prisma` actual, asegurando que coexista perfectamente con el nuevo Módulo de Economía y Logros que acabamos de implementar.

## 3. Cambios Propuestos en `schema.prisma`

Debemos volver a inyectar el siguiente código en `g:\No-Henry\KeyWords\V2\prisma\schema.prisma`.

### A. Modificación en `JobApplication`
Debemos restaurar el enlace al diccionario global:

```prisma
model JobApplication {
  // ... campos existentes ...
  
  // NUEVO: Enlace al diccionario global de puestos (Capa 3)
  canonicalPositionId   String?
  canonicalPosition     CanonicalPosition? @relation(fields: [canonicalPositionId], references: [id], onDelete: SetNull)
}
```

### B. Restauración de los Módulos 5 y 6

Añadiremos los módulos perdidos justo antes del Módulo 7 (Economía).

```prisma
// ==========================================
// MÓDULO 5: DICCIONARIO GLOBAL DE PUESTOS
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
  canonicalPosition   CanonicalPosition @relation(fields: [canonicalPositionId], references: [id], onDelete: Cascade)
}

// ==========================================
// MÓDULO 6: CROWDSOURCING Y MODERACIÓN
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
  user                User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt           DateTime @default(now())
}
```

## 4. Verificación

Una vez implementado, el archivo `schema.prisma` tendrá:
- Módulo 1: Autenticación
- Módulo 2: Core (Candidatos)
- Módulo 3: Diccionario de Keywords
- Módulo 4: Métricas
- **Módulo 5: Diccionario Global de Puestos (Restaurado)**
- **Módulo 6: Moderación (Restaurado)**
- Módulo 7: Economía y Suscripciones (Existente)
- Módulo 8: Logros (Existente)

## 5. Próximos Pasos (Pendientes de Aprobación)
1. Editar `schema.prisma` para inyectar este código.
2. Ejecutar `npx prisma format` para asegurar la indentación.
3. Ejecutar `npx prisma db push` para aplicar los cambios a la base de datos de Neon sin perder los datos de economía actuales.