# Plan de Limpieza y Optimización del Proyecto

He realizado un análisis exhaustivo del código y de las dependencias del proyecto `keywords.2`. A continuación, presento los hallazgos y el plan de acción propuesto.

## 1. Código No Utilizado Detectado

He identificado archivos que parecen no estar siendo utilizados por ninguna parte activa de la aplicación:

- **`src/lib/ia/helpers/localFallback.ts`**: Este archivo exporta funciones de fallback (`localFallback`, `localFallbackAuto`) que no son importadas por `controller.ts` ni por ningún otro archivo activo. Parece código muerto o una estrategia antigua de respaldo.
- **`src/lib/prisma.ts`**: Este archivo inicializa el cliente de Prisma, pero no es importado por ningún archivo de la aplicación (ni API routes ni componentes).
- **`src/components/ui/*.tsx`**: La mayoría de los componentes de UI están en uso, pero vale la pena confirmar si se desea mantener toda la biblioteca si no se usan todos (aunque es práctica común en shadcn mantenerlos).

## 2. Dependencias y Base de Datos (Prisma)

El proyecto tiene instaladas las dependencias de **Prisma** (`@prisma/client`, `prisma`) y define un esquema complejo en `prisma/schema.prisma`. Sin embargo:
- La lógica actual de la aplicación (Stores de Zustand en `src/store/`) utiliza **`localStorage`** para la persistencia de datos (CVs, aplicaciones, estadísticas).
- No hay código activo que realice consultas a la base de datos a través de Prisma.
- El archivo de migración `plan_migracion_sql.md` sugiere que esto es parte de un plan futuro o en progreso.

**Pregunta:** ¿Deseas mantener Prisma y su esquema para la futura migración, o prefieres limpiarlo por ahora si el enfoque es puramente local?

## 3. Rutas de Depuración (`Debug`)

El directorio **`src/app/debug`** y su API correspondiente **`src/app/api/debug`** están activos y funcionales.
- Se utilizan para verificar el estado de los proveedores de IA.
- Hay un enlace en el `Navbar`.

**Acción:** Confirmar si se deben mantener estas rutas para producción o si se deben proteger/eliminar.

## 4. Revisión de `package.json`

He verificado el uso de las dependencias que podrían parecer "sobrantes":
- **`openai`**: ✅ Se usa en `src/lib/ia/providers/deepseek.ts` (DeepSeek usa la SDK de OpenAI).
- **`mammoth`**: ✅ Se usa en `src/app/api/parse-cv/route.ts` para leer archivos .docx.
- **`pdf2json`**: ✅ Se usa en `src/app/api/parse-cv/route.ts` para leer archivos .pdf.
- **`xlsx`**: ✅ Se usa en `src/lib/excel.ts` para importar/exportar datos.
- **`recharts`**: ✅ Se usa en `src/components/StatsView.tsx`.
- **`tw-animate-css`**: ✅ Se usa en `src/app/globals.css`.

## Pasos de Ejecución Propuestos

1.  **Eliminar código muerto confirmado:**
    - Borrar `src/lib/ia/helpers/localFallback.ts`.
    - (Opcional) Borrar `src/lib/prisma.ts` si no se va a usar pronto.
2.  **Decisión sobre Prisma:**
    - Si se decide limpiar: Desinstalar `@prisma/client` y `prisma`, borrar `prisma/` y `src/lib/prisma.ts`.
    - Si se decide mantener: Dejar como está (sabiendo que no afecta el bundle del cliente).
3.  **Decisión sobre Debug:**
    - Mantener o eliminar según tu preferencia.

Por favor, confirma qué acciones deseas que ejecute, especialmente respecto a **Prisma** y la carpeta **Debug**.
