-- Filtros de la búsqueda diaria: modalidades aceptadas y hasta qué seniority postular.
-- Solo agrega columnas con valor por defecto; no toca datos existentes.
ALTER TABLE "JobSearchSettings" ADD COLUMN "workModes" TEXT[] DEFAULT ARRAY['REMOTE', 'REMOTE_US_HOURS', 'HYBRID']::TEXT[];
ALTER TABLE "JobSearchSettings" ADD COLUMN "seniorityPolicy" TEXT NOT NULL DEFAULT 'FLEXIBLE';
