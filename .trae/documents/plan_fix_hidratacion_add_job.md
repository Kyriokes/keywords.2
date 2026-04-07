# Plan: Corrección de hidratación inicial en `/user/add-job`

## 1) Summary

Resolver el bug donde la página `/user/add-job` muestra “Todavía no hay suficiente información” en la primera carga, aunque sí existan CVs y postulaciones en base de datos.\
La solución propuesta es hidratar explícitamente los datos requeridos (`applications` y `cvs`) al montar la página, para que `getKeywordStats` siempre calcule con estado real y no con arrays vacíos iniciales.

## 2) Current State Analysis

* La página [page.tsx](file:///g:/No-Henry/KeyWords/V2/src/app/user/add-job/page.tsx#L16-L34) consume `applications` y `cvs`, y calcula `keywordStats` con `getKeywordStats(...)`, pero no ejecuta carga inicial.

* Los stores arrancan vacíos:

  * [applicationStore.ts](file:///g:/No-Henry/KeyWords/V2/src/store/applicationStore.ts#L35-L43) inicia `applications: []` y solo carga con `fetchApplications`.

  * [cvStore.ts](file:///g:/No-Henry/KeyWords/V2/src/store/cvStore.ts#L25-L33) inicia `cvs: []` y solo carga con `fetchCVs`.

* `/user/dashboard` sí hidrata postulaciones en mount ([dashboard/page.tsx](file:///g:/No-Henry/KeyWords/V2/src/app/user/dashboard/page.tsx#L14-L16)), por eso al navegar luego a `/user/add-job` el estado ya está en memoria y funciona.

* No existe `layout.tsx` en `src/app/user/` para centralizar hidratación de todas las subrutas.

## 3) Proposed Changes

### Archivo: `src/app/user/add-job/page.tsx`

**Qué cambiar**

* Incorporar `useEffect` para cargar datos al primer render de la página.

* Consumir `fetchApplications` desde `useApplicationStore`.

* Consumir `fetchCVs` desde `useCvStore`.

* Agregar estado local de “hidratación inicial” para diferenciar “aún cargando” vs “no hay suficiente información”.

**Por qué**

* Evita dependencia implícita de haber visitado antes otra pantalla (`/user/dashboard` o perfil).

* Garantiza que el cálculo de `getKeywordStats` refleje datos actuales de DB en el primer acceso directo.

**Cómo (decisión concreta)**

* En `useEffect` de montaje:

  * Ejecutar `Promise.all([fetchApplications(), fetchCVs()])`.

  * Marcar `isHydrating=false` cuando ambas promesas finalicen (con `finally`).

* Ajustar el bloque UI del panel lateral:

  * Si `isHydrating === true`: mostrar estado de carga (“Cargando información…”).

  * Si `isHydrating === false` y `cvs.length === 0`: mantener mensaje actual de “Aún no tenés un CV cargado”.

  * Si `isHydrating === false` y `keywordStats.length === 0`: mantener mensaje actual de “Todavía no hay suficiente información”.

  * Si hay stats: render actual de `matched/missing` sin cambios funcionales.

## 4) Assumptions & Decisions

* **Decisión tomada:** aplicar fix local en `/user/add-job` (rápido, acotado y sin impacto global).

* **No se incluye en este cambio:** refactor de hidratación global en `src/app/user/layout.tsx` (sería una mejora posterior, no necesaria para cerrar este bug puntual).

* **Compatibilidad:** se respeta la arquitectura actual con Zustand + server actions; sin cambios en contratos de backend.

## 5) Verification Steps

* Caso A (repro principal):

  * Abrir sesión.

  * Ir directo a `/user/add-job` en primer acceso (hard refresh o nueva pestaña).

  * Validar que primero se vea estado de carga y luego los insights reales (si existen datos).

* Caso B:

  * Usuario con CV cargado y postulaciones en DB.

  * Confirmar que ya no aparece falso negativo de “insuficiente información” al primer ingreso.

* Caso C:

  * Usuario sin CV en DB.

  * Confirmar que se mantiene mensaje correcto de “Aún no tenés un CV cargado”.

* Caso D:

  * Usuario con CV pero sin postulaciones.

  * Confirmar mensaje correcto de “Todavía no hay suficiente información”.

