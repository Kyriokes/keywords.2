# 🚀 KeyWords - Inteligencia Artificial para Búsqueda Laboral y Reclutamiento

> **"Transformando la búsqueda de empleo: de un juego de azar a una estrategia basada en datos."**

## 📖 Resumen Ejecutivo
**KeyWords** es una plataforma de próxima generación impulsada por Inteligencia Artificial diseñada para optimizar el proceso de postulación a empleos. Aprovechando el poder de los Modelos de Lenguaje Grande (LLMs) y la extracción inteligente de palabras clave, cierra la brecha semántica entre el CV de un candidato y la descripción del puesto. La plataforma proporciona métricas accionables, seguimiento de postulaciones y optimización de perfiles para maximizar la tasa de éxito de los candidatos (Hunters), al mismo tiempo que ofrece herramientas robustas para Reclutadores y Empresas.

## ✨ Propuesta de Valor
- **Para Candidatos (Hunters):** Deja de enviar CVs genéricos. Entiende exactamente qué habilidades te faltan para los roles que deseas y haz un seguimiento sistemático de tus postulaciones.
- **Para Reclutadores:** Analiza y compara instantáneamente CVs contra las descripciones de puestos mediante análisis semántico de IA, ahorrando horas de filtrado manual.
- **Para Empresas:** Gestiona los flujos de reclutamiento con insights basados en datos y ranking de candidatos asistido por IA.

## 🎯 Funcionalidades Principales

### 1. Análisis Inteligente de CVs y Postulaciones
- **Soporte Multiformato:** Extracción de texto sin fricciones desde documentos PDF y Word.
- **Extracción Semántica de Palabras Clave:** Impulsado por LLMs (Groq, Gemini, DeepSeek, OpenRouter, HuggingFace, Cerebras, Mistral, Cohere y Ollama local) para identificar habilidades técnicas (hard skills), habilidades blandas (soft skills) y tecnologías.
- **Diccionario Canónico:** Un diccionario de inteligencia centralizado que entiende que "React.js", "ReactJS" y "React" son la misma habilidad, permitiendo un análisis de brechas (gap analysis) preciso.

### 2. Seguimiento de Postulaciones (ATS para Candidatos)
- **Panel de Control Centralizado (Dashboard):** Rastrea todas las postulaciones, sus estados y fechas en un solo lugar seguro.
- **Agrupación por Posición:** Agrupa postulaciones por el rol deseado (ej. "Desarrollador Frontend", "Científico de Datos").
- **Historial Inmutable:** Mantiene un registro exacto del título y la descripción original del trabajo en el momento de la postulación.

### 3. Análisis de Match con IA
- **Análisis de Brechas (Gap Analysis):** Compara el CV procesado contra la descripción del trabajo para identificar palabras clave y habilidades faltantes.
- **Agnóstico de Proveedor:** Alterna fácilmente entre diferentes modelos de IA para encontrar el analizador más rentable o preciso.
- **Métricas de Proveedores:** Monitorea el rendimiento, la velocidad de generación y la tasa de aceptación de diferentes modelos de IA.

### 4. Gestión Robusta de Identidad y Perfiles
- **Control de Acceso Basado en Roles (RBAC):** Experiencias distintas diseñadas para los roles `ADMIN`, `HUNTER`, `RECRUITER` y `BUSINESS`.
- **Separación de Responsabilidades:** Entidades `Profile` (Perfil) independientes de las identidades `User` (Usuario) para garantizar la privacidad de los datos, el cumplimiento normativo y una lógica de negocio flexible.

## 🏗️ Arquitectura Funcional y Modelo de Datos

El sistema está construido sobre un modelo de datos relacional robusto y altamente escalable utilizando PostgreSQL y Prisma ORM:

- **Módulo de Identidad:** `User`, `Account`, `Session` (Integración con Auth.js).
- **Módulo Core:** `Profile`, `CV`, `JobApplication`, `Position`.
  - Un *Profile* actúa como la identidad profesional, poseyendo múltiples *CVs* y *JobApplications*.
  - Una *JobApplication* enlaza un *CV* específico a una *Position* y almacena la descripción analizada del trabajo.
- **Módulo de Inteligencia:** `Keyword`, `KeywordAlias`, `CVKeyword`, `JobApplicationKeyword`.
  - Las relaciones N:M permiten responder consultas complejas como: *"Muéstrame todos los CVs que tengan 'React' y 'TypeScript' para posiciones 'Frontend'."*
- **Módulo de Métricas:** `ProviderStats` para monitorear el uso y la eficiencia de la IA.

## 🛠️ Stack Tecnológico (Visión Estratégica)

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion (para fluidez en la experiencia de usuario).
- **Gestión de Estado:** Zustand (para un estado global ligero y predecible).
- **Backend/API:** Server Actions & Route Handlers de Next.js para comunicación fluida cliente-servidor.
- **Base de Datos:** PostgreSQL gestionado a través de Prisma ORM.
- **Autenticación:** Auth.js (NextAuth v5 beta) para inicio de sesión seguro con OAuth (Google; LinkedIn configurado pero oculto en la UI).
- **Integración de IA:** Patrón de Controlador de IA Unificado con selección ponderada entre Groq, Gemini, DeepSeek, OpenRouter, HuggingFace, Cerebras, Mistral y Cohere, y Ollama (IA Local) como último recurso.
- **Procesamiento de Archivos:** `pdf2json` y `mammoth` para el análisis robusto de documentos en el servidor.

## 🚀 Guía de Inicio (Para Desarrolladores)

### Prerrequisitos
- Node.js (v20.9+) y pnpm
- Base de datos PostgreSQL
- Credenciales OAuth de Google (Client ID y Client Secret)
- Claves de API (API Keys) para los proveedores de IA deseados (Groq, Gemini, etc.), u Ollama corriendo en local

### 1. Clonar e Instalar
```bash
git clone <repository-url>
cd KeyWords/V2
pnpm install
```

### 2. Configuración de Entorno
Copia `.env.example` a `.env` en el directorio raíz y completa los valores:
```bash
cp .env.example .env
```
Son obligatorias `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. De los proveedores de IA alcanza con configurar uno.

### 3. Configuración de Base de Datos
Aplica las migraciones a tu base de datos y genera el Prisma Client:
```bash
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

### 4. Ejecutar la Aplicación
Inicia el servidor de desarrollo:
```bash
pnpm dev
```
Navega a [http://localhost:3000](http://localhost:3000) para acceder a la plataforma.

## 🗺️ Roadmap y Visión Futura
- **Fase 1:** Seguimiento core de candidatos, análisis de CVs y análisis de brechas (Actual).
- **Fase 2:** Generación avanzada de Cartas de Presentación (Cover Letters) con IA adaptadas a descripciones de trabajo específicas.
- **Fase 3:** Panel para reclutadores para análisis masivo de CVs y ranking automatizado de candidatos.
- **Fase 4:** Extensión de navegador para importar descripciones de trabajo con un clic desde LinkedIn, Indeed y Glassdoor.

---
*Diseñado y construido con ❤️ por el equipo de KeyWords. Elevando carreras profesionales a través de los datos.*
