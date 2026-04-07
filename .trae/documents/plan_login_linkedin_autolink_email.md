# Plan de implementación: Login con LinkedIn + Autolink por email

## 1) Resumen

Implementar inicio de sesión con LinkedIn en la autenticación actual (NextAuth + Prisma Adapter), garantizando que no se dupliquen usuarios cuando el mismo email ya exista por Google.

Resultado esperado:

* Si un usuario ya existe por Google con `email X`, al ingresar por LinkedIn con `email X` se vincula la nueva cuenta OAuth al mismo `User`.

* No se crean usuarios duplicados por email.

* Si LinkedIn no devuelve email, se bloquea el flujo y se muestra una pantalla dedicada de error.

* No se realizan cambios de esquema ni migraciones de base de datos.

***

## 2) Análisis del estado actual

### Archivos relevantes confirmados

* `src/auth.config.ts`

  * Provider actual: Google.

  * Callbacks existentes: `jwt`, `session`.

  * No existe callback `signIn`.

* `src/auth.ts`

  * NextAuth con `PrismaAdapter(prisma)`.

  * Estrategia de sesión JWT.

  * Evento `createUser` crea `Profile` automáticamente.

* `src/app/login/page.tsx`

  * UI de login con botón de Google únicamente.

* `prisma/schema.prisma`

  * `User.email` con unicidad (`@unique`).

  * `Account` con unicidad compuesta (`@@unique([provider, providerAccountId])`).

### Implicaciones técnicas

* La base de datos ya tiene las restricciones necesarias para prevenir duplicados por email y por cuenta OAuth del proveedor.

* La lógica faltante está en la capa de autenticación para:

  1. agregar LinkedIn provider,
  2. controlar y normalizar email en `signIn`,
  3. ejecutar linking por email existente.

***

## 3) Cambios propuestos

### A. Configuración de proveedor OAuth

**Archivo:** `src/auth.config.ts`

**Qué se cambia**

* Agregar provider de LinkedIn junto con Google.

* Configurar scopes para obtener email.

**Por qué**

* Sin provider no existe entrada de LinkedIn al flujo.

* El email es requisito para aplicar autolink por identidad.

**Cómo**

* Importar provider de LinkedIn de NextAuth.

* Registrar provider con `LINKEDIN_CLIENT_ID` y `LINKEDIN_CLIENT_SECRET`.

* Incluir autorización con scopes necesarios para perfil + email.

***

### B. Callback `signIn` con autolink por email

**Archivo:** `src/auth.config.ts`

**Qué se cambia**

* Agregar `callbacks.signIn` (manteniendo intactos `jwt` y `session`).

**Por qué**

* Es el punto de decisión para permitir/bloquear login y evitar creación duplicada de usuarios.

**Cómo (flujo de decisión)**

1. Determinar email de login (`user.email` y/o `profile.email` según disponibilidad).
2. Normalizar email (`trim` + `toLowerCase`).
3. Si no hay email: bloquear sign-in y redirigir a flujo de error dedicado.
4. Verificar si la cuenta OAuth `(provider, providerAccountId)` ya está vinculada:

   * Si existe: permitir.
5. Si no existe cuenta OAuth:

   * Buscar `User` por email normalizado.

   * Si existe `User`: crear `Account` de LinkedIn asociada a ese `userId` (autolink).

   * Si no existe: permitir creación normal por adapter.
6. Manejar colisiones de concurrencia (unicidad) con estrategia segura:

   * Si al crear `Account` falla por unique, reconsultar cuenta y permitir si ya quedó vinculada.

   * Si no queda consistente, devolver error controlado.

**Decisión de seguridad tomada**

* Política pragmática: autolink por email válido en Google y LinkedIn.

* Solo se bloquea en ausencia de email.

***

### C. UX de login y errores

**Archivos:**

* `src/app/login/page.tsx`

* `src/app/login/...` (nueva pantalla dedicada de error, ruta exacta a definir según estructura de rutas existente)

**Qué se cambia**

* Agregar botón “Continuar con LinkedIn”.

* Incorporar navegación al flujo de error dedicado cuando falte email desde LinkedIn.

**Por qué**

* Permite usar LinkedIn en la UI.

* Cumple el requerimiento de pantalla dedicada para el caso `OAuthEmailMissing`.

**Cómo**

* Mantener acción server para `signIn("google")`.

* Agregar segunda acción server para `signIn("linkedin")`.

* Crear pantalla dedicada para errores de autenticación de OAuth con CTA de recuperación:

  * Volver a login.

  * Continuar con Google.

***

### D. Variables de entorno y documentación mínima

**Archivo:** `.env.example` (si existe en el proyecto)

**Qué se cambia**

* Agregar placeholders:

  * `LINKEDIN_CLIENT_ID=`

  * `LINKEDIN_CLIENT_SECRET=`

**Por qué**

* Evita configuración incompleta en entornos nuevos.

**Cómo**

* Añadir variables con nombres consistentes al patrón actual de providers OAuth.

***

## 4) Supuestos y decisiones cerradas

* No se requiere migración ni modificación de `prisma/schema.prisma`.

* Se mantiene `events.createUser` actual en `src/auth.ts` sin cambios.

* Se adopta autolink por email (opción A) con política pragmática.

* Caso sin email de LinkedIn: bloqueo + pantalla dedicada de error.

* Se preserva comportamiento actual de roles/sesión (`jwt` y `session` callbacks).

***

## 5) Verificación (aceptación)

### Pruebas funcionales manuales

1. **Nuevo usuario por Google**

   * Esperado: crea `User` y `Account(google)`.
2. **Mismo email por LinkedIn tras Google**

   * Esperado: no crea `User` nuevo; crea solo `Account(linkedin)` ligada al mismo `userId`.
3. **LinkedIn sin email**

   * Esperado: login bloqueado y redirección a pantalla dedicada de error.
4. **Email distinto por LinkedIn**

   * Esperado: crea un `User` nuevo (comportamiento normal).
5. **Reintento concurrente de linking**

   * Esperado: sin duplicados; estado final consistente.

### Verificación de datos

* Confirmar unicidad de usuario por email.

* Confirmar dos cuentas OAuth (Google + LinkedIn) asociadas al mismo `userId` cuando corresponde.

### Verificación de UX

* Botón de LinkedIn visible en `/login`.

* Mensajes y CTAs operativos en pantalla dedicada de error.

***

## 6) Orden de implementación sugerido

1. Actualizar `src/auth.config.ts` (provider + `signIn` callback).
2. Actualizar `src/app/login/page.tsx` (botón LinkedIn).
3. Crear pantalla dedicada de error OAuth.
4. Actualizar `.env.example` (si aplica).
5. Ejecutar pruebas manuales de aceptación.

