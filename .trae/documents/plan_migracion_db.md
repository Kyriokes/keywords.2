# Plan de Migración: De Zustand a Prisma (Base de Datos)

Este plan detalla la estrategia para migrar la gestión de estado de la aplicación desde el almacenamiento local (Zustand + LocalStorage) a una base de datos PostgreSQL utilizando Prisma, tal como se define en `schema.prisma`.

## Evaluación de la Estrategia

**Análisis de la situación actual:**

* El proyecto utiliza Zustand para el estado del cliente.

* Existe un esquema de Prisma completo y bien estructurado (`User`, `Profile`, `CV`, `JobApplication`, etc.).

* La autenticación actual es básica (password único).

* **Conclusión:** La sugerencia del usuario de implementar **"Login Primero" es la correcta y necesaria**.

**¿Por qué Login Primero?**

1. **Integridad Referencial:** El esquema de base de datos exige que casi todos los registros (`CV`, `JobApplication`, `Position`) estén vinculados a un `Profile`, y este a su vez a un `User`.
2. **Evitar Deuda Técnica:** Si comenzamos por otras funcionalidades sin usuarios reales, tendríamos que crear usuarios "ficticios" o "invitados". Migrar esos datos después a usuarios reales (Google/LinkedIn) es complejo y propenso a errores, o requeriría borrar la base de datos (lo que queremos evitar).
3. **Flujo Natural:** Al autenticar primero, cada dato creado (un CV subido, una posición guardada) nace ya con su "dueño" correcto en la base de datos.

## Fases de Implementación

### Fase 1: Fundamentos de Autenticación (Auth First)

El objetivo es establecer la identidad del usuario para poder relacionar los datos.

* [ ] **Instalación de Dependencias:** Instalar `next-auth` (Auth.js v5) y `@auth/prisma-adapter`.

* [ ] **Configuración de NextAuth:**

  * Configurar el adaptador de Prisma en `auth.ts` (o `lib/auth.ts`).

  * **Recomendación:** Empezar solo con **Google**. Integrar LinkedIn al mismo tiempo aumenta la complejidad innecesariamente. Una vez que Google funcione y cree usuarios en la DB, añadir LinkedIn es trivial (solo agregar credenciales).

  * Definir la estrategia de sesión (JWT o Base de Datos - Prisma Adapter usa DB por defecto para sesiones, lo cual es correcto según el esquema).

* [ ] **Creación Automática de Perfil:**

  * Implementar un evento `createUser` en NextAuth para que, al registrarse un usuario, se cree automáticamente su registro en `Profile`. Esto es crucial porque el resto de la app depende de `Profile`, no solo de `User`.

* [ ] **Actualizar Middleware:** Reemplazar el middleware actual basado en cookies manuales por el de NextAuth.

* [ ] **UI de Login:** Actualizar `src/app/login/page.tsx` para usar los botones de "Sign in with Google".

## Guía de Credenciales (Variables de Entorno)

Para que la autenticación funcione, necesitarás configurar estas variables en tu archivo `.env`:

### 1. `NEXTAUTH_SECRET`

Es una cadena aleatoria usada para encriptar los tokens de sesión.

* **Cómo obtenerla:** Puedes generar una segura ejecutando este comando en tu terminal (si tienes openssl): `openssl rand -base64 32`

* O simplemente usa un generador de contraseñas online y pega una cadena larga y compleja.

* **Ejemplo:** `NEXTAUTH_SECRET="tu_cadena_super_secreta_y_larga_12345"`

### 2. Google OAuth (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`)
Necesitas crear un proyecto en Google Cloud Platform.
1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un nuevo proyecto (ej: "KeyWords-App").
3. Ve a **APIs & Services** > **Credentials**.
4. Dale a **Create Credentials** > **OAuth Client ID**.
5. Tipo de aplicación: **Web application**.
6. **Authorized JavaScript origins:**
   - Agrega: `http://localhost:3000`
   - Agrega también tu dominio de producción: `https://tu-app.vercel.app` (cuando lo tengas).
7. **Authorized redirect URIs:**
   - Agrega: `http://localhost:3000/api/auth/callback/google`
   - Agrega también: `https://tu-app.vercel.app/api/auth/callback/google`
   *Nota: Google permite tener múltiples URIs, así funciona tanto en local como en producción usando las mismas credenciales (o puedes crear otro Cliente OAuth para prod si prefieres separarlos).*
8. Copia el "Client ID" y "Client Secret" a tu `.env`.

### 3. Configuración de Entorno (`AUTH_URL` / `NEXTAUTH_URL`)
Para que la aplicación sepa dónde está corriendo:
- **En Local (`.env`):**
  ```bash
  AUTH_URL="http://localhost:3000"
  AUTH_SECRET="tu_secreto_generado"
  ```
- **En Producción (Vercel/Netlify):**
  Configura las variables de entorno en el panel de control de tu proveedor de hosting:
  ```bash
  AUTH_URL="https://tu-dominio-real.com"
  AUTH_SECRET="tu_secreto_generado" (puede ser el mismo o uno nuevo)
  ```

### 4. LinkedIn (Para más adelante)
El proceso es similar en [LinkedIn Developers](https://www.linkedin.com/developers/):

1. Crear una App.
2. En "Auth", verás el Client ID y Secret.
3. Redirect URI: `http://localhost:3000/api/auth/callback/linkedin`.
4. *Nota:* LinkedIn a veces requiere verificar la empresa asociada a la app, por eso recomendamos empezar con Google para no bloquear el desarrollo.

## Notas Técnicas

* **Zustand:** No eliminaremos Zustand. Lo mantendremos como gestor de estado global del *cliente* para una UI reactiva, pero eliminaremos su persistencia `persist` (LocalStorage) a favor de una hidratación desde la DB al inicio.

* **Variables de Entorno:** Se necesitarán `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, y `NEXTAUTH_SECRET`.

