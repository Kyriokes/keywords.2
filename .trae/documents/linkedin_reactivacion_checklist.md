# Checklist de reactivación de LinkedIn

## 1) Variables de entorno

- Configurar `LINKEDIN_CLIENT_ID` con el valor real de LinkedIn Developer.
- Configurar `LINKEDIN_CLIENT_SECRET` con el valor real de LinkedIn Developer.
- Confirmar que los valores no sean placeholders.

## 2) Configuración en LinkedIn Developer

- Registrar URL de callback: `http://localhost:3000/api/auth/callback/linkedin`.
- Verificar que el producto/permisos de Sign In with LinkedIn esté habilitado.
- Confirmar acceso a scopes usados por la app: `openid profile email`.

## 3) Reactivar UI

- Restaurar botón “Continuar con LinkedIn” en `src/app/login/page.tsx`.
- Actualizar descripción de login para mencionar Google + LinkedIn.

## 4) Pruebas funcionales mínimas

- Login con Google funciona y redirige a `/user/dashboard`.
- Login con LinkedIn funciona con credenciales reales.
- Si existe usuario por Google con mismo email, LinkedIn autolinkea al mismo `userId`.
- Si LinkedIn no devuelve email, redirige a `/login/oauth-error?reason=oauth_email_missing`.

## 5) Validación final

- Revisar diagnósticos de TypeScript/IDE sin errores.
- Confirmar que no se crearon usuarios duplicados por email en base de datos.
