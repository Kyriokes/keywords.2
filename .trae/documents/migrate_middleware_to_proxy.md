# Plan de Migración: Middleware a Proxy en Next.js

## Resumen
Migrar el archivo `middleware.ts` a `proxy.ts` para cumplir con las nuevas convenciones de Next.js detalladas en su documentación. Esto eliminará la advertencia de obsolescencia (`deprecated`) que aparece durante el proceso de build.

## Análisis del Estado Actual
- El proyecto actualmente utiliza `src/middleware.ts` para manejar la protección de rutas y la autenticación mediante `NextAuth`.
- Existen logs de consola dentro del archivo que utilizan la etiqueta `[Middleware]`.
- Hay comentarios en `src/routes.config.ts` que hacen referencia al "middleware".
- El import de `zustand/middleware` en `src/store/statsStore.ts` es ajeno a Next.js y no debe ser modificado.

## Cambios Propuestos

1. **Renombrar el archivo principal**
   - Renombrar `src/middleware.ts` a `src/proxy.ts`. Según la documentación de Next.js, la exportación por defecto (`export default auth(...)`) y la configuración del `matcher` (`export const config = {...}`) siguen siendo válidas en el nuevo formato.

2. **Actualizar referencias internas en `src/proxy.ts`**
   - Cambiar todos los `console.log("[Middleware] ...")` por `console.log("[Proxy] ...")` para mantener la coherencia con el nuevo nombre.

3. **Actualizar comentarios en `src/routes.config.ts`**
   - Cambiar el comentario de la línea 15 que dice `(se manejará en el middleware)` a `(se manejará en el proxy)`.

## Suposiciones y Decisiones
- La configuración de NextAuth que envuelve el handler con `auth(...)` exportándolo por defecto (`export default auth(...)`) es 100% compatible con `proxy.ts`, ya que la documentación indica que el archivo debe exportar una única función, ya sea como exportación por defecto o nombrada como `proxy`.
- No hay otras dependencias en el código que requieran de la palabra exacta "middleware" para la redirección de Next.js.

## Pasos de Verificación
1. Ejecutar el build de la aplicación (`pnpm run build`).
2. Verificar que la advertencia `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` ya no aparezca en los logs.
3. Asegurar que la compilación sea exitosa y que el enrutamiento protegido siga funcionando como de costumbre.