# Propuesta de Esquema Prisma: Economía, Logros y Suscripciones

Basado en tus requerimientos, este es el diseño del esquema para soportar el sistema de tokens duales (Monedas y Diamantes), la preparación para las pasarelas de pago (empezando con MercadoPago) y el sistema de logros (Quests).

Este diseño es modular, escalable y evita la pérdida de datos, preparándote para la implementación del backend que mencionaste en el contexto.

## Módulo 7: Economía y Balances (Nuevo)

```prisma
// ==========================================
// MÓDULO 7: ECONOMÍA, TOKENS Y SUSCRIPCIONES
// ==========================================

// Tabla unificada para el saldo del usuario (Estado Actual)
model Balance {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Tokens Totales (Caché rápido, calculable desde Ledger/Buckets)
  coins           Int       @default(0) // Monedas (vencen)
  gems            Int       @default(0) // Diamantes (no vencen)
  
  // Estado de suscripción basado en fecha (No booleano)
  subscriptionExpiresAt DateTime? 
  
  updatedAt       DateTime  @updatedAt
}

// Lotes de Monedas (Resuelve el problema de expiraciones múltiples)
model CoinBucket {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  originalAmount  Int       // Cuánto se otorgó originalmente
  remainingAmount Int       // Cuánto queda disponible en este lote
  expiresAt       DateTime  // Cuándo expiran exactamente
  
  createdAt       DateTime  @default(now())

  @@index([userId])
  @@index([expiresAt])
}

// Tipos y Direcciones para el Ledger
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

// Libro Contable Inmutable (Ledger) - Fuente de la verdad
model TokenLedger {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  tokenType     TokenType // COIN | GEM
  direction     Direction // CREDIT | DEBIT
  amount        Int

  // Motivo del movimiento
  reason        LedgerReason
  
  // Referencia a la tabla que originó esto
  referenceType String?   // ej: "usage_log", "payment_transaction", "quest"
  referenceId   String?

  createdAt     DateTime  @default(now())

  @@index([userId])
  @@index([tokenType])
  @@index([reason])
}

// Enums para acciones específicas
enum ActionType {
  CREATE_POSTULATION
  IMPROVE_CV
  GENERATE_COVER_LETTER
}

// Historial detallado de acciones del usuario
model UsageLog {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  action          ActionType
  providerUsed    String?   
  
  // Detalle del costo
  tokensCost      Int       
  coinsConsumed   Int       @default(0)
  gemsConsumed    Int       @default(0)

  // Auditoría: Saldo antes y después de la acción
  coinsBefore     Int?
  coinsAfter      Int?
  gemsBefore      Int?
  gemsAfter       Int?
  
  createdAt       DateTime  @default(now())

  @@index([userId])
}

// Historial inmutable de compras/recargas (Preparado para MercadoPago, PayPal, etc.)
model PaymentTransaction {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  amount          Float     // Monto en dinero fiat
  currency        String    @default("ARS") // ej: ARS, USD
  
  provider        String    // "mercadopago", "paypal", "stripe"
  providerTxId    String    @unique // ID de la transacción en la pasarela
  status          String    // "pending", "approved", "rejected"
  
  type            String    // "subscription" o "gems_pack"
  
  // Qué se otorgó exactamente
  coinsGranted    Int       @default(0)
  gemsGranted     Int       @default(0)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
}
```

## Módulo 8: Sistema de Logros / Quests (Nuevo)

```prisma
// ==========================================
// MÓDULO 8: LOGROS (QUESTS)
// ==========================================

// El catálogo de logros disponibles (Gestionable por Admins)
model Quest {
  id              String    @id @default(cuid())
  title           String    // ej: "Primeros pasos"
  description     String?   // ej: "Crea tu primera postulación"
  
  rewardGems      Int       // Premio en diamantes
  
  // Lógica para validar el logro
  conditionType   ActionType // Usamos el mismo enum de ActionType
  conditionValue  Int       @default(1) // ej: 1, 5, 10
  
  isActive        Boolean   @default(true) // Permite desactivar quests viejos
  
  userProgress    UserQuest[]
}

// El progreso individual de cada usuario en los logros
model UserQuest {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  questId         String
  quest           Quest     @relation(fields: [questId], references: [id], onDelete: Cascade)
  
  progress        Int       @default(0) // Cuánto lleva (ej: 4 de 5)
  isCompleted     Boolean   @default(false)
  completedAt     DateTime?
  
  @@unique([userId, questId]) // Un usuario solo puede tener un registro por quest
  @@index([userId])
}
```

## Actualización necesaria en el Modelo `User` existente

Para que este nuevo esquema funcione, solo necesitamos agregar las relaciones inversas al modelo `User` actual. **Esto NO borra datos**, solo enlaza las nuevas tablas:

```prisma
model User {
  // ... campos actuales ...

  // Nuevas relaciones para Economía y Logros
  balance         Balance?
  coinBuckets     CoinBucket[]
  ledgers         TokenLedger[]
  usageLogs       UsageLog[]
  transactions    PaymentTransaction[]
  quests          UserQuest[]
}
```

---

## Análisis de la Propuesta (Por qué está diseñado así)

1. **`TokenLedger` (Libro Contable):** Es la fuente de la verdad absoluta. Cada suma o resta de tokens (ya sea por pago, consumo o expiración) queda registrada. Permite responder preguntas de negocio complejas (ARPU, LTV, diamantes regalados vs vendidos).
2. **`CoinBucket` (Lotes de Monedas):** Soluciona el problema crítico de la expiración de suscripciones solapadas. Cada vez que el usuario paga, se crea un "bucket" con sus monedas y su propia fecha de expiración. El consumo siempre gasta primero del bucket que esté más próximo a vencer.
3. **`Balance` (Caché Rápido):** Ahora sirve como un "estado actual" rápido de leer para la UI, pero si alguna vez hay un error, su valor se puede reconstruir al 100% sumando y restando el `TokenLedger`. Además, `subscriptionExpiresAt` reemplaza al débil `isSubscribed`.
4. **`UsageLog` Fortalecido:** Se agregaron `balanceBefore` y `balanceAfter` para auditoría, y se unificó el tipo de acción usando el enum `ActionType`, evitando bugs por errores de tipeo.
5. **Agnóstico a la Pasarela:** `PaymentTransaction` tiene `provider`, ideal para empezar con MercadoPago y escalar a PayPal/Stripe sin alterar la base de datos.

¿Qué te parece este esquema para las tablas? ¿Cumple con tu visión antes de avanzar a crear la migración?