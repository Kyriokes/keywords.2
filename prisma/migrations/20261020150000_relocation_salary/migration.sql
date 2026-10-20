-- Sueldo publicado (USD por mes) que tiene que superar una oferta para aceptar mudarse.
-- Columna opcional: null = nunca aceptar mudanza. No toca datos existentes.
ALTER TABLE "JobSearchSettings" ADD COLUMN "minRelocationSalaryUsd" INTEGER;
