# Resumen del Estado del Proyecto: Keywords V2

Este documento proporciona un resumen detallado del estado actual del proyecto, su arquitectura, funcionalidades implementadas y configuración técnica.

## 1. Visión General
**Keywords V2** es una aplicación web desarrollada con **Next.js 16** diseñada para optimizar la búsqueda de empleo. Su núcleo funcional es el **rastreo de aplicaciones laborales** y el **análisis inteligente de CVs** mediante Inteligencia Artificial para detectar palabras clave y mejorar la compatibilidad con ofertas de trabajo.

## 2. Stack Tecnológico
- **Frontend/Framework**: Next.js 16 (App Router), React 19, TypeScript.
- **Estilos**: Tailwind CSS 4, Framer Motion (animaciones), Lucide React (iconos).
- **UI Components**: Shadcn/ui (basado en Radix UI).
- **Estado Global**: Zustand (stores para CVs, aplicaciones, posiciones, estadísticas).
- **Backend/DB**: Prisma ORM con PostgreSQL.
- **Autenticación**: NextAuth.js v5 (Beta) con Google Provider.
- **IA**: Integración modular con Google Generative AI, OpenAI, Groq, y Ollama (local).
- **Procesamiento de Archivos**: `mammoth` (.docx), `pdf2json` (.pdf), `xlsx`.

## 3. Funcionalidades Implementadas

### A. Autenticación y Seguridad
- **Sistema**: NextAuth v5 con estrategia JWT.
- **Roles**: Sistema RBAC (Role-Based Access Control) con 4 roles:
  - `ADMIN`: Acceso total.
  - `HUNTER`: Candidato (rol por defecto).
  - `RECRUITER`: Reclutador.
  - `BUSINESS`: Empresa.
- **Protección de Rutas**: Configuración centralizada en `src/routes.config.ts`.
  - Rutas públicas: `/`, `/login`, `/api/auth`.
  - Rutas protegidas: `/admin`, `/user`, `/recruiter`, `/business`.
- **Manejo de Sesión**: Creación automática de perfil de usuario al registrarse.

### B. Gestión de Candidatos (Hunter)
- **Dashboard**: Vista principal con estadísticas y resumen de actividad.
- **Perfil**: Gestión de información profesional.
- **CVs**:
  - Carga y parseo de documentos (PDF/Word).
  - Almacenamiento y visualización de contenido extraído.
- **Aplicaciones**:
  - Registro de nuevas postulaciones (`/user/add-job`).
  - Tablero de seguimiento de aplicaciones.
  - Análisis de "match" entre CV y descripción del puesto.

### C. Inteligencia Artificial
- **Motor de Análisis**: Sistema ubicado en `src/lib/ia` que permite cambiar dinámicamente de proveedor (OpenAI, Gemini, DeepSeek, etc.).
- **Extracción de Keywords**: Identificación automática de habilidades requeridas en ofertas.
- **Comparación**: Evaluación de CV vs Job Description para sugerir mejoras.

## 4. Estructura del Proyecto (Directorios Clave)
- `src/app`: Rutas de la aplicación (App Router).
- `src/lib`: Utilidades, configuración de IA, prisma client.
- `src/store`: Gestión de estado del cliente (Zustand).
- `src/components`: Componentes reutilizables (UI y lógica de negocio).
- `src/auth.ts` / `src/auth.config.ts`: Configuración principal de NextAuth.
- `src/proxy.ts`: Lógica de middleware para protección de rutas y redirecciones.

## 5. Estado Actual y Observaciones Recientes
- **Protección de Rutas**: Se ha implementado recientemente una lógica estricta de redirección basada en roles.
- **Middleware**: Existe un archivo `src/proxy.ts` que contiene la lógica de middleware (verificación de sesión y roles), aunque se debe verificar su correcta integración como `middleware.ts` en la raíz o src para que Next.js lo ejecute automáticamente.
- **Base de Datos**: El esquema Prisma está definido y migrado, soportando las relaciones complejas entre usuarios, aplicaciones y palabras clave.

## 6. Próximos Pasos Sugeridos (Implícitos)
- **Verificación de Middleware**: Asegurar que `src/proxy.ts` esté siendo utilizado correctamente por Next.js (normalmente renombrándolo o importándolo en `middleware.ts`).
- **Pruebas de Flujo**: Validar el flujo completo de registro -> creación de perfil -> carga de CV -> análisis con IA.
- **Optimización de UI**: Refinar la interfaz de usuario en las nuevas páginas protegidas (`/unauthorized`, etc.).
