# Plan de Mejoras: Panel de Administración y Diagnóstico de IA

Este plan detalla los pasos para convertir la página de "Debug" en un "Panel de Administración" completo, mejorando la visibilidad del estado de los proveedores de IA y añadiendo herramientas de diagnóstico (Ping).

## 1. Renombrar Debug a Admin Panel

El objetivo es formalizar la herramienta de depuración como un panel administrativo.

### Cambios Propuestos
- **Mover Directorio**: Renombrar `src/app/debug` a `src/app/admin`.
- **Actualizar Navegación**: Modificar `src/components/Navbar.tsx` para apuntar a `/admin` y cambiar el texto a "Admin Panel".
- **Actualizar Rutas**: Verificar y actualizar `src/routes.config.ts` para proteger la nueva ruta `/admin`.
- **Actualizar UI**: Cambiar el título en `src/app/admin/page.tsx` a "Admin Panel".

## 2. Implementar Funcionalidad de Ping (Backend)

Permitir verificar la conectividad con cada proveedor de IA individualmente.

### Cambios Propuestos
- **Interfaz AiProvider**: Añadir método `checkHealth(): Promise<boolean>` a `src/lib/ia/providers/types.ts`.
- **Implementación en Proveedores**: Implementar `checkHealth` en:
  - `src/lib/ia/providers/groq.ts`
  - `src/lib/ia/providers/gemini.ts`
  - `src/lib/ia/providers/deepseek.ts`
  - `src/lib/ia/providers/ollama.ts`
  - *Estrategia*: Enviar un prompt mínimo (ej: "ping") y verificar que la respuesta sea exitosa.
- **Nuevo Endpoint API**: Crear `src/app/api/admin/ping/route.ts`.
  - Recibe `{ provider: string }`.
  - Instancia el proveedor usando `src/lib/ia/providers/factory.ts`.
  - Ejecuta `checkHealth()`.
  - Retorna `{ status: 'ok' | 'error', latency: number }`.

## 3. Mejorar Visualización de Proveedores (Frontend)

Mostrar todos los proveedores configurados, independientemente de si tienen estadísticas de uso previas.

### Cambios Propuestos
- **Lista Completa**: En `src/app/admin/page.tsx`, definir la lista maestra de proveedores: `['groq', 'gemini', 'deepseek', 'ollama']`.
- **Tabla Unificada**:
  - Iterar sobre la lista maestra en lugar de las claves de las estadísticas.
  - Mostrar datos de estadísticas si existen, o "Sin datos" si no.
  - Añadir columna de "Estado" con el botón de "Ping".
- **Acción de Ping**:
  - Implementar función `handlePing(providerId)` en el cliente.
  - Mostrar indicador de carga mientras se hace el ping.
  - Mostrar resultado (éxito/error) visualmente en la fila correspondiente (ej: badge verde/rojo).

## Archivos Afectados
- `src/app/debug/` -> `src/app/admin/` (Renombrado)
- `src/components/Navbar.tsx`
- `src/routes.config.ts` (si existe)
- `src/lib/ia/providers/types.ts`
- `src/lib/ia/providers/*.ts` (Todos los proveedores)
- `src/app/api/admin/ping/route.ts` (Nuevo)

## Pasos de Verificación
1. Acceder a `/admin` y verificar que carga correctamente.
2. Verificar que todos los proveedores (Groq, Gemini, Deepseek, Ollama) aparecen en la lista.
3. Probar el botón "Ping" para cada proveedor:
   - Groq (Debería funcionar si la key es válida).
   - Otros (Deberían reportar error o éxito según su configuración).
