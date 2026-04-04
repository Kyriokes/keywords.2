# Plan de Refuerzo del Esquema Prisma

## 1. Análisis del Esquema Actual
El esquema actual de la base de datos de **KeyWords** está estructurado en 6 módulos principales:
1. **Autenticación:** Gestión de usuarios, sesiones y roles (`ADMIN`, `HUNTER`, `RECRUITER`, `BUSINESS`). Separación de la identidad (`User`) y la información profesional (`Profile`).
2. **Core (Candidatos):** Gestión de `CV`s, posiciones deseadas (`Position`) y postulaciones (`JobApplication`).
3. **Inteligencia (Keywords):** Un diccionario robusto con `Keyword` y `KeywordAlias` para normalizar habilidades, con relaciones N:M hacia CVs y postulaciones.
4. **Métricas:** `ProviderStats` para rastrear la eficiencia de los modelos de IA.
5. **Diccionario Global de Puestos:** Estructura jerárquica de `Sector` -> `CanonicalPosition` -> `PositionAlias` para normalizar los títulos de los puestos.
6. **Moderación (Crowdsourcing):** `MappingSuggestion` para que la comunidad proponga mejoras al diccionario global.

### Capacidades Actuales:
- **Excelente para el Hunter:** Rastrea todo su proceso, normaliza sus skills y las compara con la oferta.
- **Normalización de Datos:** El sistema de alias (tanto para Keywords como para Positions) garantiza que los datos sean estadísticamente útiles.

## 2. Respuesta a tu Consulta: ¿Se puede escalar a futuro sin "dropear" (borrar) datos?

**SÍ, ABSOLUTAMENTE.** La pérdida de datos que ocurrió anteriormente no es el comportamiento normal de una base de datos en producción, sino un efecto secundario de usar el comando de desarrollo (`prisma migrate dev`) cuando se había alterado el historial de migraciones localmente. 

En un entorno real (y usando las prácticas correctas), **agregar nuevas tablas, campos o relaciones NUNCA borra los datos existentes.**

### ¿Cómo se hace de forma segura a futuro?
1. **Añadir nuevas tablas:** Simplemente se crean los nuevos modelos (ej: `Chat`, `Message`, `Company`). Al aplicar la migración, Prisma crea las tablas vacías sin tocar el resto.
2. **Añadir nuevos campos opcionales:** Si agregas un campo `phoneNumber String?` a un usuario, Prisma simplemente agrega la columna. Los usuarios existentes tendrán `null`.
3. **Añadir campos obligatorios a tablas con datos:** Prisma te pedirá un valor por defecto (default) para llenar ese nuevo campo en las filas existentes, o requerirá que lo hagas en dos pasos (primero opcional, llenar datos, luego obligatorio).

**Conclusión:** Podremos agregar el ATS B2B, el chat, el seguimiento de entrevistas y todo lo demás más adelante **sin perder un solo registro**.

## 3. Propuesta de Mejora Inmediata (Aprovechando la DB vacía)

Ya que solicitaste incluir **Suscripciones y Pagos** y preparar el terreno, propongo agregar un Módulo 7 al esquema para gestionar la monetización (preparado para integrarse con Stripe, MercadoPago, etc.):

### Módulo Propuesto: Monetización (Suscripciones)

Añadiremos los modelos necesarios para manejar diferentes niveles de acceso (ej: Free, Pro, Enterprise):

```prisma
// ==========================================
// MÓDULO 7: SUSCRIPCIONES Y PAGOS (STRIPE/ETC)
// ==========================================

enum PlanTier {
  FREE
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  CANCELED
  PAST_DUE
  UNPAID
}

model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @unique // Relación 1:1 con User
  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  tier                 PlanTier           @default(FREE)
  status               SubscriptionStatus @default(ACTIVE)
  
  // Datos del proveedor de pagos (ej. Stripe)
  stripeCustomerId     String?            @unique
  stripeSubscriptionId String?            @unique
  stripePriceId        String?
  
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)

  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
}
```

### Cambios a realizar en el Plan:
1. **Actualizar `schema.prisma`**: Agregar el modelo `Subscription` y sus enums, y conectar la relación inversa en el modelo `User`.
2. **Generar Migración**: Crear la migración limpia (`add_subscriptions`). Como la DB está vacía, no habrá problemas de consistencia.

## 4. Resumen
Este cambio dejará la base de datos lista para cuando decidas implementar la pasarela de pagos, bloqueando o habilitando funciones (como más usos de IA) dependiendo del `tier` del usuario. Las demás características (Chat, Empresas, Reclutadores viendo Hunters) las dejaremos para el futuro, con la tranquilidad de que **sabemos cómo agregarlas sin perder datos.**