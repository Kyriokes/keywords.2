# Plan de implementación: Posponer LinkedIn manteniendo backend y ocultando UI

## 1) Resumen

Objetivo: posponer temporalmente el uso de login con LinkedIn sin romper la app, manteniendo la base técnica ya implementada en backend para reactivarla cuando estén disponibles credenciales válidas.

Estrategia acordada:
- Mantener provider/callbacks de LinkedIn en autenticación.
- Ocultar el acceso desde la UI de login (quitar botón/CTA de LinkedIn).
- Mantener un documento/checklist de reactivación para retomar rápido más adelante.

---

## 2) Análisis del estado actual

### Estado confirmado en código
- `src/auth.config.ts`
  - Tiene provider Google + LinkedIn.
  - LinkedIn lee `LINKEDIN_CLIENT_ID` y `LINKEDIN_CLIENT_SECRET`.
- `src/auth.ts`
  - Tiene `callbacks.signIn` con autolink por email y manejo de errores OAuth (`oauth_email_missing`, `oauth_linking_failed`).
- `src/app/login/page.tsx`
  - Muestra botones de Google y LinkedIn.
- `src/app/login/oauth-error/page.tsx`
  - Pantalla dedicada para errores OAuth.
- `.env`
  - Existen placeholders para LinkedIn (`tu_client_id`, `tu_client_secret`), no credenciales reales.

### Riesgo operativo si se deja “tal cual”
- La app no debería romper por tener LinkedIn configurado con placeholders.
- El problema es de UX: el usuario verá “Continuar con LinkedIn” y fallará al intentar usarlo.
- Por eso conviene ocultar el botón mientras no haya credenciales reales.

---

## 3) Cambios propuestos

### A) Ocultar LinkedIn en la pantalla de login

**Archivo:** `src/app/login/page.tsx`

**Qué cambiar**
- Quitar temporalmente:
  - El formulario `signIn("linkedin")`.
  - El texto de descripción que menciona LinkedIn.

**Por qué**
- Evita ofrecer un flujo que hoy no es usable.
- Preserva experiencia estable para usuarios.

**Cómo**
- Dejar solo el botón de Google como método visible.
- Mantener estructura visual actual del card.

---

### B) Mantener backend de LinkedIn sin cambios funcionales

**Archivos:**  
- `src/auth.config.ts`  
- `src/auth.ts`  
- `src/app/login/oauth-error/page.tsx`

**Qué cambiar**
- No tocar lógica implementada de provider/callback/error page.

**Por qué**
- Permite reactivar rápidamente LinkedIn cuando se consigan variables de entorno reales.
- Evita retrabajo y riesgo de perder lógica de autolink ya validada.

**Cómo**
- Mantener intacto el flujo técnico existente.
- La funcionalidad queda “dormida” por ausencia de entrada desde UI.

---

### C) Documento de reactivación rápida

**Archivo:** `.trae/documents/linkedin_reactivacion_checklist.md` (nuevo)

**Qué incluir**
- Variables requeridas:
  - `LINKEDIN_CLIENT_ID`
  - `LINKEDIN_CLIENT_SECRET`
- Callback URL en LinkedIn Developer:
  - `/api/auth/callback/linkedin`
- Verificación funcional mínima:
  - Login Google normal.
  - Login LinkedIn visible nuevamente.
  - Autolink con mismo email.
  - Error controlado sin email.

**Por qué**
- Cumple preferencia de “retomar luego” sin rediseño.

---

## 4) Supuestos y decisiones cerradas

- No se harán cambios de base de datos ni migraciones.
- No se comentará código en archivos productivos; se hará ocultamiento por UI.
- No se eliminará el backend de LinkedIn (provider + callback), solo se desactiva la exposición al usuario final.
- El estado “pospuesto” se considera aceptable mientras login Google permanezca estable.

---

## 5) Verificación

### Pruebas funcionales
1. `/login` muestra solo Google.
2. Login con Google funciona y redirige a `/user/dashboard`.
3. No hay acceso visible a LinkedIn desde UI.

### Pruebas de estabilidad
1. Diagnósticos del proyecto sin errores nuevos.
2. Rutas existentes (incluyendo auth) operativas.

### Criterio de aceptación
- El usuario final no ve LinkedIn en login.
- La app queda estable y lista para reactivar LinkedIn más adelante con mínimo esfuerzo.

---

## 6) Orden de implementación

1. Ajustar `src/app/login/page.tsx` para ocultar LinkedIn.
2. Validar que auth y dashboard continúen funcionando con Google.
3. Crear `.trae/documents/linkedin_reactivacion_checklist.md`.
4. Ejecutar verificación final de diagnósticos.

