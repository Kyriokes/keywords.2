# Plan: evaluar y aplicar `isApproved` en `Keyword` sin dropear la BD

## Resumen

* Objetivo: agregar `isApproved Boolean @default(false)` al modelo `Keyword` y hacerlo de forma segura, evitando cualquier reset/drop de base de datos.

* Criterio de éxito: la columna nueva existe en PostgreSQL, datos previos se conservan, la app compila y Prisma Client refleja el nuevo campo.

## Análisis del estado actual

* El modelo `Keyword` está definido en `g:\No-Henry\KeyWords\V2\prisma\schema.prisma` y hoy no incluye `isApproved`.

* El datasource usa PostgreSQL (`provider = "postgresql"`), por lo que el cambio esperado es un `ALTER TABLE ... ADD COLUMN`.

* Ya existe historial de migraciones en `g:\No-Henry\KeyWords\V2\prisma\migrations\...`, por lo que el flujo correcto es mantener migraciones versionadas.

* Riesgo clave: no es el campo en sí, sino el comando usado. `prisma migrate dev` puede pedir reset si detecta drift/conflictos entre schema, migraciones y DB real.

## Cambios propuestos

* `g:\No-Henry\KeyWords\V2\prisma\schema.prisma`

  * En `model Keyword`, agregar:

    * `isApproved Boolean @default(false)`

  * Motivo: habilitar moderación/aprobación explícita de keywords.

* Nueva migración SQL en `g:\No-Henry\KeyWords\V2\prisma\migrations\<timestamp>_add_keyword_is_approved\migration.sql`

  * Cambio esperado:

    * `ALTER TABLE "Keyword" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false;`

  * Motivo: aplicar evolución no destructiva y auditable.

* Opcional de endurecimiento posterior (si negocio lo requiere)

  * Índice en `isApproved` para consultas de moderación/visibilidad:

    * `@@index([isApproved])`

  * Se decide según volumen de consultas.

## Supuestos y decisiones

* Decisión principal: este cambio, por sí mismo, **no debería dropear la BD** en PostgreSQL; es una alteración aditiva.

* Supuesto operativo: no hay drift severo entre migraciones y DB actual.

* Decisión de seguridad: usar flujo de migración controlada (generar y revisar SQL) en lugar de cambios ciegos.

* Regla de protección: si Prisma reporta necesidad de reset/drop, se detiene ejecución y se prepara estrategia de resolución de drift sin pérdida de datos.

## Verificación

* Verificar migración generada:

  * Confirmar que sólo contiene `ADD COLUMN` y no incluye `DROP TABLE`, `DROP COLUMN` ni `TRUNCATE`.

* Verificar estado de Prisma:

  * Comprobar que la migración queda aplicada y registrada en historial.

* Verificar datos:

  * Validar que registros existentes de `Keyword` permanecen y que `isApproved` queda en `false` por defecto.

* Verificar aplicación:

  * Regenerar cliente Prisma y validar tipos/consultas que lean `Keyword`.

## Respuesta concreta a la duda original

* Agregar `isApproved Boolean @default(false)` a `Keyword` **no implica** dropear la BD por naturaleza del cambio.

* El único escenario de drop/reset es una ejecución de migración con drift/conflicto; por eso se controla revisando SQL antes de aplicar.

