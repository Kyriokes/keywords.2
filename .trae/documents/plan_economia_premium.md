# Plan Arquitectónico: Economía, Logros y Suscripciones (V2)

## 1. Visión General

El objetivo es implementar un sistema de economía dual (Monedas y Diamantes) preparado para monetización, junto con un sistema de logros (Quests) para gamificar la experiencia del usuario. El diseño prioriza la auditoría, la escalabilidad y la prevención de vulnerabilidades (ej. race conditions, saldo negativo).

**Economía Dual:**

* **Monedas (Coins):** Obtenidas por suscripción, tienen fecha de caducidad (31 días) y son la prioridad 1 de consumo.

* **Diamantes (Gems):** Obtenidos por compra directa o completando logros. No caducan y son la prioridad 2 de consumo (fallback).

## 2. Arquitectura del Modelo de Datos (Esquema Prisma)

El diseño se divide en tres capas fundamentales para garantizar la integridad:

1. **Ledger (Verdad Absoluta):** Registro inmutable de cada transacción.
2. **Buckets (Lógica de Negocio):** Manejo de la expiración de lotes de monedas.
3. **Balance (Performance):** Caché rápido del saldo actual para la UI.

### Módulo 7: Economía y Balances

```prisma
// ==========================================
// MÓDULO 7: ECONOMÍA, TOKENS Y SUSCRIPCIONES
// ==========================================

// 1. Capa de Performance: Caché del saldo actual
model Balance {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Tokens Totales (Calculable desde Ledger/Buckets)
  coins           Int       @default(0) // Monedas (vencen)
  gems            Int       @default(0) // Diamantes (no vencen)
  
  // Control de concurrencia (Optimistic Locking)
  version         Int       @default(0)
  
  // Estado de suscripción
  subscriptionExpiresAt DateTime? 
  
  updatedAt       DateTime  @updatedAt
}

// 2. Capa de Lógica: Lotes de Monedas (Resuelve expiraciones múltiples)
model CoinBucket {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  originalAmount  Int       // Cuánto se otorgó originalmente
  remainingAmount Int       // Cuánto queda disponible en este lote
  expiresAt       DateTime  // Cuándo expiran exactamente
  
  createdAt       DateTime  @default(now())

  // Índices para optimizar la búsqueda de buckets próximos a expirar
  @@index([userId, expiresAt])
}

// 3. Capa de Auditoría: El Libro Contable Inmutable (Ledger)
enum TokenType {
  COIN
  GEM
}

enum Direction {
  CREDIT
  DEBIT
}

enum LedgerReason {
  SUBSCRIPTION_GRANT
  USAGE
  QUEST_REWARD
  PURCHASE
  EXPIRATION
  ADMIN_ADJUSTMENT
}

model TokenLedger {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Tipo de operación
  tokenType     TokenType 
  direction     Direction 

  // Variación en este movimiento
  coinsDelta    Int       @default(0)
  gemsDelta     Int       @default(0)

  reason        LedgerReason
  
  // Trazabilidad e Idempotencia
  referenceType String?   // ej: "usage_log", "payment_transaction", "quest"
  referenceId   String?
  bucketId      String?   // Opcional: para saber de qué lote salió/entró la moneda

  // Auditoría estricta: Saldo resultante de la transacción
  balanceAfterCoins Int   @default(0)
  balanceAfterGems  Int   @default(0)

  createdAt     DateTime  @default(now())

  @@index([userId])
  @@index([tokenType])
  @@index([reason])
  
  // Idempotencia fuerte: Evitar procesar dos veces el mismo evento
  // Solo se aplica si referenceType y referenceId no son nulos. Prisma lo permite.
  @@unique([referenceType, referenceId])
}

// Enums para acciones específicas del usuario
enum ActionType {
  CREATE_POSTULATION
  IMPROVE_CV
  GENERATE_COVER_LETTER
}

// Historial detallado de consumo en la plataforma
model UsageLog {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  action          ActionType
  providerUsed    String?   
  
  // Detalle del consumo mixto
  // Nota: total tokens = coinsConsumed + gemsConsumed
  coinsConsumed   Int       @default(0)
  gemsConsumed    Int       @default(0)

  // Auditoría: Saldo antes y después
  coinsBefore     Int?
  coinsAfter      Int?
  gemsBefore      Int?
  gemsAfter       Int?
  
  createdAt       DateTime  @default(now())

  @@index([userId])
}

enum PaymentStatus {
  PENDING
  APPROVED
  REJECTED
}

// Historial inmutable de compras (Agnóstico al proveedor)
model PaymentTransaction {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  amount          Float     // Monto en dinero fiat
  currency        String    @default("ARS") 
  
  provider        String    // "mercadopago", "paypal", "stripe"
  providerTxId    String    @unique 
  status          PaymentStatus @default(PENDING)
  
  type            String    // "subscription" o "gems_pack"
  
  // Qué se otorgó exactamente
  coinsGranted    Int       @default(0)
  gemsGranted     Int       @default(0)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
}
```

### Módulo 8: Sistema de Logros (Quests)

```prisma
// ==========================================
// MÓDULO 8: LOGROS (QUESTS)
// ==========================================

// El catálogo de logros disponibles
model Quest {
  id              String    @id @default(cuid())
  title           String    // ej: "Primeros pasos"
  description     String?   // ej: "Crea tu primera postulación"
  
  rewardGems      Int       // Premio en diamantes
  
  // Lógica de validación
  conditionType   ActionType 
  conditionValue  Int       @default(1) // ej: 5 postulaciones
  
  isActive        Boolean   @default(true) 
  
  userProgress    UserQuest[]
}

// Progreso individual del usuario
model UserQuest {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  questId         String
  quest           Quest     @relation(fields: [questId], references: [id], onDelete: Cascade)
  
  progress        Int       @default(0) 
  isCompleted     Boolean   @default(false)
  completedAt     DateTime?
  
  @@unique([userId, questId]) 
  @@index([userId])
}
```

## 3. Lógica Clave a Implementar (Backend)

### A. Consumo de Créditos (`consumeCredits`)

La piedra angular de este sistema será la función `consumeCredits(userId, amount)`. Para garantizar la integridad, esta función **deberá usar** **`prisma.$transaction`** y seguir este flujo estricto:

1. **Lectura y Bloqueo:** Lectura y bloqueo del `Balance` y `CoinBuckets` dentro de la transacción para evitar concurrencia. El campo `version` queda como control adicional de consistencia, no como mecanismo principal de reintento.
2. **Cálculo de Consumo:**

   * Intentar cubrir el `amount` iterando sobre los `CoinBucket` disponibles, restando su `remainingAmount`.

   * Si las monedas no alcanzan, cubrir el resto descontando de los `gems`.

   * Si la suma total (monedas + diamantes) no alcanza, abortar la transacción (Error: Saldo Insuficiente).
3. **Escritura (Transaccional):**

   * Actualizar los `CoinBucket` afectados.

   * Actualizar el `Balance` (restando coins y gems, e incrementando `version` + 1).

   * Insertar en `TokenLedger` los movimientos (un DEBIT por coins, otro por gems si aplica, registrando `balanceAfterCoins`, `balanceAfterGems` y `bucketId`).

   * Insertar en `UsageLog` el registro de la acción con los saldos before/after.

   * (Opcional) Disparar evento para actualizar el progreso de los `UserQuest`.

### B. Idempotencia en Pagos (Webhooks)

Al recibir webhooks (ej. MercadoPago), antes de otorgar tokens se verificará si el `providerTxId` ya existe en `PaymentTransaction` con estado `APPROVED` o si ya existe un registro en `TokenLedger` para esa transacción. Si ya existe, se ignora la petición para evitar duplicar saldo.

### C. Expiración de Monedas (Cron Job)

Se implementará un proceso programado (Cron/Worker) o un trigger manual que periódicamente busque `CoinBucket` expirados (`expiresAt < now()`) y con `remainingAmount > 0`. Por cada uno:

* El monto a expirar será **exactamente** el `remainingAmount` del bucket al momento del proceso.

* Pondrá `remainingAmount = 0`.

* Creará un registro en `TokenLedger` con `reason: EXPIRATION`.

* Descontará el saldo correspondiente del `Balance`.

## 4. Próximos Pasos (Aprobación Requerida)

Si apruebas este plan definitivo:

1. Actualizaré el archivo `prisma/schema.prisma` con estos modelos.
2. Ejecutaré la migración de Prisma (asegurando conexión previa a la BD).
3. Escribiremos juntos el servicio backend robusto para `consumeCredits` utilizando transacciones de Prisma.

