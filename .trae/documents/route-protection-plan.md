# Plan de Protección de Rutas por Roles (RBAC)

## 1. Resumen
El objetivo es implementar un sistema de Control de Acceso Basado en Roles (RBAC) para la aplicación. Siguiendo tu excelente intuición, centralizaremos la configuración de qué roles pueden ver qué vistas en un solo archivo, y utilizaremos el Middleware de Next.js para interceptar las peticiones y proteger las rutas antes de que se rendericen. Los administradores (`ADMIN`) tendrán acceso universal.

## 2. Análisis del Estado Actual
- **Base de Datos (`prisma/schema.prisma`)**: Ya tienes definido el `enum UserRole` (`ADMIN`, `HUNTER`, `RECRUITER`, `BUSINESS`) y el modelo `User` tiene el campo `role` por defecto en `HUNTER`.
- **Autenticación (`src/auth.ts`)**: NextAuth está configurado con JWT, pero actualmente solo guarda el `id` del usuario en el token y la sesión. El `role` no está disponible, por lo que el middleware no puede saber qué rol tiene el usuario sin consultar la base de datos (lo cual sería ineficiente).
- **Middleware (`src/middleware.ts`)**: Actualmente solo verifica si el usuario está logueado para proteger las rutas que empiezan con `/user`.

## 3. Explicación: ¿Cómo se maneja normalmente esto?
En el ecosistema de Next.js (App Router), la protección de rutas por roles se maneja combinando tres capas:
1. **Middleware (Protección Centralizada/Dura)**: Se intercepta la petición antes de que llegue al servidor. Aquí es donde entra tu idea del "archivo centralizado". El middleware lee la ruta, busca en un diccionario de configuración qué roles están permitidos, revisa el JWT del usuario y bloquea/redirige si no tiene permisos.
2. **Layouts de Servidor (Protección Estructural)**: Agrupando páginas en carpetas como `(admin)/layout.tsx` para proteger secciones enteras y mostrar interfaces de error amigables si alguien sin permisos intenta entrar.
3. **Componentes (Protección Granular UI)**: Mostrar u ocultar botones (ej. un botón de "Borrar Usuario") dependiendo del rol del usuario que se lee desde la sesión.

Nos enfocaremos en la **capa 1 (Middleware)** que es la más segura y coincide con tu idea.

## 4. Cambios Propuestos

### Paso 1: Extender los Tipos de NextAuth
Crearemos un archivo para decirle a TypeScript que nuestra sesión ahora incluye el rol.
- **Archivo**: `src/types/next-auth.d.ts` (o similar).
- **Acción**: Declarar que el módulo `next-auth` y `next-auth/jwt` incluyen la propiedad `role: UserRole`.

### Paso 2: Inyectar el Rol en la Sesión
- **Archivo**: `src/auth.ts`
- **Acción**: Modificar los `callbacks` de `jwt` y `session` para que el `role` viaje de la base de datos al Token, y del Token a la Sesión. Esto permite que el Middleware lo lea sin hacer consultas lentas a Prisma.

### Paso 3: Crear el Archivo Centralizado de Rutas
- **Archivo**: `src/routes.config.ts` (Nuevo)
- **Acción**: Exportar constantes y diccionarios que definan la lógica de acceso.
  *Ejemplo de estructura:*
  ```typescript
  export const protectedRoutes = {
    '/admin': ['ADMIN'],
    '/recruiter': ['RECRUITER', 'ADMIN'],
    '/user': ['HUNTER', 'ADMIN'],
    '/business': ['BUSINESS', 'ADMIN']
  };
  export const publicRoutes = ['/', '/login', '/api/auth'];
  export const DEFAULT_LOGIN_REDIRECT = '/user'; // o dependiendo del rol
  ```

### Paso 4: Actualizar el Middleware
- **Archivo**: `src/middleware.ts`
- **Acción**: 
  - Leer el `req.nextUrl.pathname`.
  - Leer `req.auth?.user?.role`.
  - Iterar sobre `protectedRoutes` para ver si la ruta actual requiere algún rol específico.
  - Si no está logueado -> Redirigir a `/login`.
  - Si está logueado pero no tiene el rol necesario -> Redirigir a una página de `/unauthorized` o al home.

## 5. Decisiones y Asunciones
- **Asunción**: El rol `ADMIN` siempre se inyectará dinámicamente o se validará para tener acceso a todo, por lo que no es necesario escribirlo manualmente en cada arreglo del diccionario de configuración, podemos programar el middleware para que si el rol es `ADMIN`, pase directamente.
- **Decisión**: Usaremos la estrategia JWT de NextAuth (ya configurada) porque es la única que permite leer la sesión directamente en el Middleware en Edge runtime.

## 6. Siguientes Pasos (Ejecución)
Una vez apruebes este plan:
1. Crearé los tipos de TypeScript.
2. Modificaré `auth.ts`.
3. Crearé `routes.config.ts`.
4. Refactorizaré `middleware.ts`.
5. Crearemos una vista sencilla de `/unauthorized` para los rechazos.