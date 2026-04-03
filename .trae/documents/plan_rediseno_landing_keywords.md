# Plan de acción — Rediseño de la landing de KeyWords

## Summary

Objetivo: transformar la home actual en una landing clara, breve y orientada a conversión para candidatos, enfocada en que el usuario entienda en pocos segundos qué hace KeyWords, por qué le sirve y cuál es el siguiente paso.

Resultado esperado tras implementar este plan:

- Mensaje principal entendible sin esfuerzo: organizar postulaciones + detectar qué mejorar en el perfil.
- Jerarquía de contenido alineada con el enfoque definido: problema → solución → beneficio → diferencial → acción.
- Placeholder visual simple que ayude a entender el producto sin invertir todavía en un mock elaborado.
- Experiencia consistente con la marca y con el flujo real actual del producto.

## Current State Analysis

### Estado actual detectado

- La home actual vive en `src/app/page.tsx`, pero el contenido real está concentrado en `src/components/LandingPageClient.tsx`.
- La landing hoy resuelve solo un hero corto con un CTA y una grilla de dos cards.
- Una de esas cards (“Nueva Sesión”) está deshabilitada y marcada como “Próximamente”, lo que introduce fricción en la primera visita.
- El layout global agrega `Navbar` y `Footer` a la landing, por lo que cualquier mejora del home queda condicionada por esos componentes.
- Hay inconsistencia de marca:
  - `LandingPageClient.tsx` usa “KeyWords”.
  - `Navbar.tsx` usa “JobTracker”.
  - `layout.tsx` metadata usa “Job Tracker”.
- El tono actual del README es más amplio y técnico que la dirección UX deseada para la landing.

### Problemas UX/UI principales

- La propuesta de valor no está priorizada para escaneo rápido.
- No hay narrativa progresiva por scroll.
- La home parece más una pantalla de acceso que una landing de producto.
- Hay elementos que desvían atención del objetivo principal de conversión.
- No se aprovecha el valor diferencial del producto de forma simple y concreta.

## Proposed Changes

### 1. Replantear la arquitectura de contenido de la landing

**Archivo principal:** `src/components/LandingPageClient.tsx`

**Qué cambiar**

- Reemplazar la estructura actual de “hero + cards” por una landing de 5 bloques:
  1. Hero / primer impacto
  2. Cómo funciona
  3. Beneficios concretos
  4. Diferencial con IA
  5. CTA final

**Por qué**

- Permite que el usuario entienda rápidamente el producto y, al hacer scroll, confirme utilidad y confianza.
- Alinea la home con el objetivo de conversión y con la propuesta ya validada conceptualmente.

**Cómo**

- Hero:
  - Nombre del producto: KeyWords
  - Título principal: “Dejá de enviar CVs a ciegas.”
  - Subtítulo centrado en organización + mejora del perfil.
  - CTA principal: “Empezar gratis”
  - CTA secundario: “Ya tengo cuenta”
  - Placeholder visual simple a la derecha o debajo en mobile
- Sección “Cómo funciona”:
  - 3 pasos simples y escaneables
- Sección de beneficios:
  - bullets de valor concreto, sin lenguaje técnico
- Sección diferencial:
  - una pieza corta que explique por qué no es solo un tracker
- CTA final:
  - repetir acción principal con texto de cierre

### 2. Sustituir el mock elaborado por un placeholder visual simple y útil

**Archivo principal:** `src/components/LandingPageClient.tsx`

**Apoyo posible:** `src/app/globals.css`

**Qué cambiar**

- Incorporar un bloque visual tipo placeholder que simule:
  - lista breve de postulaciones
  - micro insight como “Te falta: React, TypeScript”

**Por qué**

- Refuerza comprensión inmediata sin comprometer tiempo de diseño en una UI que todavía puede cambiar.
- Ayuda a “entender sin leer demasiado”.

**Cómo**

- Resolverlo con una tarjeta estática simple, de baja fidelidad, coherente con el sistema visual actual.
- Evitar gráficos complejos, dashboards realistas o capturas detalladas.
- Diseñarlo como componente visual descartable o fácilmente reemplazable en una fase posterior.

### 3. Simplificar el flujo de decisión del usuario en la home

**Archivo principal:** `src/components/LandingPageClient.tsx`

**Qué cambiar**

- Eliminar del home el patrón actual de dos cards con decisiones paralelas.
- Reemplazarlo por un flujo principal de conversión con CTA dominante.

**Por qué**

- En una landing, demasiadas decisiones iniciales reducen claridad.
- La opción deshabilitada “Nueva Sesión” da sensación de producto incompleto justo en el primer contacto.

**Cómo**

- CTA principal:
  - si no hay sesión: llevar a `/login`
  - si hay sesión: llevar a `/user/dashboard`
- CTA secundario:
  - si no hay sesión: “Ya tengo cuenta”
  - si hay sesión: texto alternativo orientado a volver al panel
- Retirar de la landing pública cualquier acción deshabilitada o “próximamente”.

### 4. Ajustar la navegación superior para acompañar la nueva landing

**Archivo afectado:** `src/components/Navbar.tsx`

**Qué cambiar**

- Revisar la navbar en estado público para que acompañe la lógica de landing y no compita con ella.

**Por qué**

- La landing necesita foco; la navegación pública debe ser simple y consistente con el objetivo de conversión.

**Cómo**

- Mantener branding consistente con “KeyWords”.
- En estado público, priorizar:
  - logo/nombre
  - link a inicio
  - CTA de acceso
- En estado autenticado, conservar navegación de producto existente.
- Evaluar una presentación más limpia o menos pesada visualmente en la home.

### 5. Reducir ruido en el footer para la primera impresión

**Archivo afectado:** `src/components/Footer.tsx`

**Qué cambiar**

- Simplificar el footer para que no robe protagonismo ni comunique features no listas.

**Por qué**

- El placeholder de donaciones y otros elementos secundarios compiten con la conversión.

**Cómo**

- Mantener firma y enlaces externos si se consideran importantes.
- Retirar o despriorizar mensajes “próximamente” que no aportan a la decisión del usuario.
- Dejar un footer más neutral y corto para la landing.

### 6. Corregir consistencia de marca y metadata

**Archivo afectado:** `src/app/layout.tsx`

**Archivo afectado indirectamente:** `src/components/Navbar.tsx`

**Qué cambiar**

- Unificar naming visible y metadata con la marca “KeyWords”.

**Por qué**

- La inconsistencia actual debilita percepción de producto y genera ruido innecesario.

**Cómo**

- Ajustar título y descripción metadata al mensaje nuevo de la landing.
- Alinear el branding del header con el nombre mostrado en hero.

### 7. Mantener coherencia visual con el sistema existente

**Archivos base:** `src/components/LandingPageClient.tsx`, `src/app/globals.css`

**Qué cambiar**

- Rediseñar sin romper el lenguaje visual actual de botones, cards, espaciados y tipografía.

**Por qué**

- Reduce esfuerzo de implementación.
- Mantiene consistencia con el resto del producto.

**Cómo**

- Reutilizar componentes de UI existentes.
- Mantener Tailwind y tokens actuales.
- Usar animaciones sutiles ya presentes con Framer Motion, solo donde sumen claridad.

## Assumptions & Decisions

- Audiencia principal de la landing: candidatos individuales, no recruiters ni empresas.
- La landing debe vender utilidad concreta, no visión técnica ni ambición futura.
- El mock visual será un placeholder simple, no una representación final del dashboard.
- El objetivo principal de conversión actual es llevar a login o al dashboard según sesión.
- No se incorporarán por ahora:
  - testimonios
  - pricing
  - comparativas
  - secciones técnicas
  - features futuras no disponibles
- El tono de copy debe ser:
  - simple
  - directo
  - útil
  - no corporativo
- La implementación debe priorizar mobile-first y lectura rápida por bloques.

## Proposed Copy Direction

### Hero

- Marca: KeyWords
- Headline: “Dejá de enviar CVs a ciegas.”
- Subheadline sugerido: “Registrá tus postulaciones y descubrí qué te falta para conseguir el trabajo que querés.”
- CTA principal: “Empezar gratis”
- CTA secundario: “Ya tengo cuenta”

### Cómo funciona

- Paso 1: Subís tu CV
- Paso 2: Registrás tus postulaciones
- Paso 3: Recibís insights

### Beneficios

- Dejás de postularte a ciegas
- Entendés qué pide el mercado
- Mejorás tu CV con datos reales
- Tenés tu historial en un solo lugar

### Diferencial

- Título sugerido: “No es un Excel más”
- Soporte breve: la IA analiza tu perfil y tus búsquedas para darte recomendaciones concretas

### Cierre

- Texto sugerido: “Empezá a mejorar tu búsqueda hoy”
- CTA: “Crear cuenta” o “Empezar gratis”, según se quiera máxima consistencia con el hero

## File-by-File Execution Outline

### `src/components/LandingPageClient.tsx`

- Convertirlo en la landing principal completa
- Reorganizar estructura semántica en secciones
- Sustituir cards actuales por narrativa de producto
- Añadir placeholder visual simple
- Mantener lógica de CTA según sesión

### `src/components/Navbar.tsx`

- Unificar branding
- Simplificar navegación pública
- Mantener navegación autenticada existente

### `src/components/Footer.tsx`

- Reducir ruido visual y mensajes de features futuras

### `src/app/layout.tsx`

- Actualizar metadata y naming general

### `src/app/globals.css`

- Solo si hace falta soporte puntual para layout/gradientes/separadores del nuevo home
- Evitar introducir estilos ad hoc si puede resolverse con utilidades existentes

### `src/components/LandingCard.tsx`

- Probablemente dejará de ser necesario para la home
- Decisión de implementación:
  - mantenerlo si se reutiliza en otro contexto
  - removerlo de la landing sin eliminar el archivo si no es urgente

## Verification Steps

- Confirmar que la landing comunica en menos de un scroll:
  - qué es
  - para quién es
  - qué acción tomar
- Validar que no existan CTAs rotos, deshabilitados o ambiguos en la home pública.
- Verificar consistencia de naming entre hero, navbar y metadata.
- Revisar comportamiento con y sin sesión iniciada.
- Validar responsive:
  - mobile
  - tablet
  - desktop
- Comprobar que el placeholder visual se entienda como apoyo y no como feature final cerrada.
- Revisar que el copy evite lenguaje técnico, corporativo o enfocado en recruiters/empresas.

## Recommended Implementation Order

1. Unificar mensaje y estructura de contenido
2. Rediseñar hero y CTAs
3. Añadir secciones de scroll
4. Incorporar placeholder visual simple
5. Ajustar navbar y footer
6. Corregir branding/metadata
7. Probar consistencia visual y responsive

## Criterio de aceptación final

La nueva landing será correcta si, al verla por primera vez, un usuario entiende rápidamente:

- que KeyWords le sirve para organizar sus postulaciones
- que puede mejorar su CV y su búsqueda con insights
- que el siguiente paso es empezar o iniciar sesión

Y además:

- la experiencia se siente más producto que pantalla de acceso
- desaparecen distracciones y mensajes “próximamente” del primer contacto
- la propuesta queda lista para iterar más adelante con un mock más elaborado cuando el flujo completo del producto esté cerrado
