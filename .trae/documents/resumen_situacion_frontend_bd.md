# Resumen de Situación: Frontend vs Esquema de Base de Datos

A continuación se presenta un contraste detallado entre lo que actualmente se visualiza en las vistas del Frontend y las posibilidades latentes que nos brinda el esquema de la base de datos (BD) actual, identificando todo lo que falta implementar sin necesidad de tocar la BD.

## 1. Módulo Core y Perfil del Usuario

### Vistas Actuales
* **Mi Perfil (`/user/profile`):** 
  * Se pueden subir y listar CVs.
  * Se pueden definir los Puestos Deseados (carpetas personales).
* **Agregar Postulación (`/user/add-job`):**
  * El usuario pega una oferta, la IA extrae palabras clave y el título exacto.
  * El usuario puede asociar la postulación a una de sus carpetas personales.
* **Dashboard (`/user/dashboard`):**
  * Tabla con el historial de postulaciones.
  * Estadísticas de progreso.

### Posibilidades del Esquema BD (Falta Implementar)
* **Gestión del CV Primario:** La BD tiene el campo `isPrimary` en la tabla `CV`. El Frontend debería permitir marcar un CV como el principal/favorito.
* **Roles de Usuario (`UserRole`):** La BD soporta roles `ADMIN`, `HUNTER`, `RECRUITER`, `BUSINESS`. Actualmente la UI solo contempla el flujo para `HUNTER` (y un panel crudo para `ADMIN`). Faltan las vistas para que un `RECRUITER` pueda explorar perfiles o ver candidatos compatibles.
* **Estado de la Postulación:** La tabla `JobApplication` tiene un campo `status` (`APPLIED`, `REJECTED`, etc.). En el Dashboard, el usuario debería poder cambiar este estado (ej. "Pasé a entrevista", "Rechazado") para hacer un tracking real tipo ATS.

---

## 2. Diccionario Global de Puestos y Crowdsourcing (4 Capas)

### Vistas Actuales
* **Totalmente Ausente en la UI:** Actualmente el usuario solo interactúa con sus "Puestos Deseados" locales. El mapeo en background hacia el `CanonicalPosition` ocurre silenciosamente en el backend (vía `application-actions.ts`), pero el usuario no lo ve ni interactúa con él.

### Posibilidades del Esquema BD (Falta Implementar)
* **UI de Sugerencias (Crowdsourcing):** La tabla `MappingSuggestion` está lista. 
  * Faltaría agregar en el Dashboard o en la vista de la postulación un botón para que el usuario sugiera a qué Puesto Canónico pertenece una oferta si la IA no lo detectó (`ALIAS_TO_CANONICAL`).
  * Faltaría una vista para que un Recruiter sugiera a qué Sector pertenece un puesto (`CANONICAL_TO_SECTOR`).
* **Panel de Moderación:** En el `/admin`, falta construir la interfaz donde los administradores puedan ver estas sugerencias (`PENDING`) y aprobarlas o rechazarlas.
* **Filtros Avanzados:** En el Dashboard, se podría permitir al usuario filtrar sus postulaciones no solo por sus carpetas, sino por el `Sector` global o `CanonicalPosition`.

---

## 3. Inteligencia Artificial y Métricas

### Vistas Actuales
* **Panel Admin (`/admin`):** Muestra un panel técnico de la salud de los proveedores (Groq, Gemini, etc.) basado en respuestas exitosas/fallidas.

### Posibilidades del Esquema BD (Falta Implementar)
* **Métricas Detalladas (`ProviderStats`):** La BD cuenta cuántas veces se generaron, aceptaron o rechazaron respuestas por IA. Faltaría un dashboard analítico (para el Admin o el usuario) que muestre qué IA está siendo más útil para extraer keywords correctamente.

---

## 4. Economía Premium y Suscripciones

### Vistas Actuales
* **Totalmente Ausente en la UI:** Las vistas de pago, billetera o restricciones de consumo no existen.

### Posibilidades del Esquema BD (Falta Implementar)
* **Vista de Billetera/Suscripción:** Una nueva página (ej. `/user/billing`) donde el usuario pueda:
  * Ver su saldo actual (`Balance`: Monedas y Diamantes).
  * Ver la fecha de expiración de su suscripción (`subscriptionExpiresAt`).
  * Ver el historial de transacciones y uso (`PaymentTransaction` y `UsageLog`).
* **Bloqueos de Funcionalidad (Paywalls):** El frontend debe empezar a ocultar o deshabilitar botones (como "Procesar con IA" en `/user/add-job`) si el backend reporta saldo insuficiente.
* **Integración de Pasarela:** Faltaría el botón/flujo en el frontend para iniciar un pago (MercadoPago/PayPal) que impacte en `PaymentTransaction`.

---

## 5. Sistema de Logros (Quests)

### Vistas Actuales
* **Totalmente Ausente en la UI:** No hay mención de misiones, logros o recompensas.

### Posibilidades del Esquema BD (Falta Implementar)
* **Panel de Logros:** Una vista (o sección en el Dashboard) que consulte la tabla `UserQuest` unida a `Quest`.
  * Mostrar misiones disponibles (ej. "Crea tu primera postulación").
  * Mostrar barras de progreso (`progress` / `conditionValue`).
  * Reclamar recompensa (sumar diamantes).
* **Gestor de Logros (Admin):** Interfaz en `/admin` para crear nuevos `Quest` y definir sus recompensas sin tocar código.
* **Notificaciones Toast:** Al completar una acción (ej. subir un CV), el backend puede actualizar el `UserQuest` y el frontend debería mostrar un "¡Logro desbloqueado!" si `isCompleted` pasa a `true`.

---

## Resumen Ejecutivo
El **backend y la base de datos están a un nivel arquitectónico "Enterprise"**, listos para monetización, escalabilidad y análisis de datos masivos. 
Sin embargo, el **frontend sigue siendo un MVP** (Minimum Viable Product) enfocado únicamente en la carga y visualización básica de datos para un solo rol (Hunter). 

**Los grandes bloques pendientes de UI son:**
1. Panel de Suscripciones y Billetera (Economía).
2. Panel de Gamificación (Logros).
3. Interfaz de Moderación y Crowdsourcing (para Diccionario Global).
4. Vistas y flujos para Recruiters.
5. Edición de estados de las postulaciones.