# Plan de Mejora de Diagnóstico de Proveedores IA

El objetivo es mejorar la capacidad de diagnóstico del sistema para identificar la causa exacta de los errores de conexión con los proveedores (específicamente DeepSeek y Gemini), proporcionando mensajes de error detallados en el Panel de Administración.

## 1. Actualizar Interfaz `AiProvider`
Modificar la firma de `checkHealth` para que devuelva un objeto con detalles del error, en lugar de un simple booleano.

### Archivo: `src/lib/ia/providers/types.ts`
```typescript
export interface HealthCheckResult {
    ok: boolean;
    latency?: number;
    error?: string;
}

export interface AiProvider {
    // ...
    checkHealth(): Promise<HealthCheckResult>;
}
```

## 2. Actualizar Implementación de Proveedores
Adaptar cada proveedor para capturar errores específicos y devolver mensajes descriptivos.

### Archivos Afectados:
- **`src/lib/ia/providers/deepseek.ts`**:
  - Capturar error 402 -> "Saldo insuficiente (Billing)".
  - Capturar otros errores -> Mensaje original.
- **`src/lib/ia/providers/gemini.ts`**:
  - Capturar error 404 -> "Modelo no encontrado o API no habilitada".
- **`src/lib/ia/providers/groq.ts`** y **`src/lib/ia/providers/ollama.ts`**:
  - Actualizar para cumplir con la nueva interfaz.

## 3. Actualizar API de Ping
Modificar el endpoint para propagar el mensaje de error específico al frontend.

### Archivo: `src/app/api/admin/ping/route.ts`
- Utilizar el resultado detallado de `checkHealth`.
- Devolver el mensaje de error en la respuesta JSON cuando `ok` sea false.

## 4. Verificación
- Probar el botón "Ping" en el panel de admin.
- Verificar que DeepSeek muestre claramente "Saldo insuficiente" si aplica.
- Verificar que Gemini muestre la razón del fallo (404/API no habilitada).

## Nota sobre el problema actual
Basado en los logs proporcionados:
- **DeepSeek**: Error 402 (Insufficient Balance) -> Confirmado problema de facturación.
- **Gemini**: Error 404 (Not Found) -> Indica que el modelo `gemini-1.5-flash` no está habilitado en el proyecto de Google Cloud o la API Key tiene restricciones.
