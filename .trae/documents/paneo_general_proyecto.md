# Paneo General del Proyecto: KeyWords

## 1. Resumen Ejecutivo (¿Qué se busca?)
**KeyWords** es una plataforma de próxima generación diseñada para transformar y optimizar el proceso de búsqueda de empleo (y eventualmente el reclutamiento) utilizando Inteligencia Artificial. Su objetivo principal es cerrar la "brecha semántica" entre los CVs de los candidatos y las descripciones de las ofertas laborales. 
Actualmente, el sistema se enfoca en el candidato (rol `HUNTER`), ofreciéndole un ATS (Applicant Tracking System) personal donde puede:
- Subir sus CVs (extracción de texto desde PDF/Word).
- Analizar ofertas laborales mediante IA para extraer palabras clave (Hard skills, Soft skills).
- Comparar su CV contra la oferta para realizar un análisis de brechas (Gap Analysis).
- Hacer un seguimiento centralizado de todas sus postulaciones y métricas.

## 2. Análisis del Estado Actual (¿Dónde estamos?)

El proyecto se encuentra en la **Fase 1** de su Roadmap (Seguimiento core de candidatos, análisis de CVs y análisis de brechas). La base técnica y arquitectónica ya está implementada y es altamente robusta.

### Arquitectura y Stack Tecnológico
- **Framework:** Next.js 15+ (App Router) con React 19.
- **Estilos:** Tailwind CSS v4, componentes UI basados en Radix (shadcn/ui).
- **Estado Global:** Zustand (Stores modulares: `applicationStore`, `cvStore`, `PositionStore`, `statsStore`).
- **Base de Datos:** PostgreSQL gestionado a través de Prisma ORM.
- **Autenticación:** Auth.js (NextAuth v5 beta) con un modelo sólido de roles (`ADMIN`, `HUNTER`, `RECRUITER`, `BUSINESS`).

### Modelo de Datos (DB Schema)
El esquema de Prisma demuestra madurez arquitectónica:
1. **Separación de Identidad:** Existe el modelo `User` (autenticación OAuth/Credenciales) separado del modelo `Profile` (datos profesionales). Esto permite flexibilidad y privacidad.
2. **Core de Postulaciones:** Un `Profile` tiene múltiples `CV`s (uno primario), `Position`s (roles deseados) y `JobApplication`s (ofertas a las que postuló).
3. **Módulo de Inteligencia (Diccionario):** Existe un diccionario de `Keyword` (texto canónico) y `KeywordAlias` para entender que "React.js", "ReactJS" y "react" son la misma entidad. Relaciones N:M con CVs y Aplicaciones.
4. **Métricas de IA:** La tabla `ProviderStats` trackea cuántas peticiones se generan, aceptan o rechazan por proveedor de IA.

### Integración de Inteligencia Artificial
- **Controlador Agnóstico (AI Factory):** Implementado en `src/lib/ia/`. Soporta múltiples proveedores (OpenAI, Gemini, Groq, DeepSeek, Mistral, Ollama, etc.).
- **Flujo:** La función `processJobApplication` envía el título y descripción del trabajo al LLM, valida que la respuesta cumpla con el esquema JSON esperado (habilidades, herramientas, seniorities) y guarda estadísticas del uso del proveedor.

### Estado de la Interfaz (Frontend)
- **Dashboard del Usuario (`/user/dashboard`):** Implementado con pestañas para ver "Postulaciones" (Tabla interactiva), "Estadísticas" (Gráficos) y "Ajustes" (Carga/Guardado legacy).
- **Flujo de Postulación (`/user/add-job`):** Formulario para analizar una nueva oferta laboral y compararla con el perfil.
- Existen vistas administrativas y landing pages preparadas.

## 3. Decisiones Arquitectónicas y Supuestos
- **Server Actions como API:** En lugar de usar exclusivamente Route Handlers (`/api`), el proyecto aprovecha intensamente las Server Actions de Next.js (`src/actions/*`) para mutaciones seguras desde el cliente.
- **Agnosticismo de IA:** El sistema no depende de un solo LLM. Si OpenAI falla o es caro, puede saltar a Groq o Gemini. El usuario puede incluso usar Ollama en local.
- **Persistencia de Feedback:** El sistema guarda si el candidato aceptó o rechazó el análisis de la IA para mejorar los prompts y medir qué proveedor da mejores resultados.

## 4. Próximos Pasos Propuestos (Basados en el Roadmap)
Dado que la Fase 1 está sólidamente cimentada, las siguientes áreas de evolución (Fases 2 a 4) son:
1. **Generación de Cover Letters (Cartas de Presentación):** Usar el contexto del `CV` y la `JobApplication` para que el LLM redacte cartas personalizadas.
2. **Panel de Reclutadores (Fase 3):** Expandir el acceso para roles `RECRUITER`, permitiendo que las empresas suban una posición y el sistema ordene (rankee) los CVs de la base de datos según el match semántico.
3. **Extensión de Navegador (Fase 4):** Facilitar la importación automática de ofertas desde LinkedIn o Glassdoor sin tener que copiar y pegar el texto en la web de KeyWords.
4. **Refinamiento del Diccionario de Keywords:** Asegurar que el proceso en background (o cron job) normalice automáticamente las nuevas palabras clave extraídas por la IA hacia términos canónicos.

---
**Conclusión:** El proyecto tiene unas bases técnicas excelentes y modernas. El core funcional para el candidato (HUNTER) está operativo y estructurado de forma que escalar hacia funcionalidades empresariales o incorporar nuevos modelos de IA sea un proceso natural y de bajo roce.