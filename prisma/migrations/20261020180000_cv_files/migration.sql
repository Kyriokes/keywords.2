-- Archivo de cada CV para subir en los formularios: idioma, link público al PDF y ruta en la PC del usuario.
-- Columnas opcionales; no toca datos existentes.
ALTER TABLE "CV" ADD COLUMN "language" TEXT;
ALTER TABLE "CV" ADD COLUMN "fileUrl" TEXT;
ALTER TABLE "CV" ADD COLUMN "filePath" TEXT;
