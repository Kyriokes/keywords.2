-- Motivo de cada descarte, reglas nuevas de la búsqueda (auto-aprobación, sueldo mínimo, tope por empresa)
-- y las preferencias que KeyWords aprende de los descartes. Solo agrega columnas opcionales o con default
-- y una tabla nueva; no toca datos existentes.

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN "skipReason" TEXT,
ADD COLUMN "skipDetail" TEXT;

-- AlterTable
ALTER TABLE "JobSearchSettings" ADD COLUMN "autoApproveMinScore" INTEGER,
ADD COLUMN "minSalaryUsdMonthly" INTEGER,
ADD COLUMN "minSalaryArsMonthly" INTEGER,
ADD COLUMN "maxPerCompanyPerMonth" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "SearchPreference" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueKey" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'USER',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "SearchPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchPreference_profileId_idx" ON "SearchPreference"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchPreference_profileId_kind_valueKey_key" ON "SearchPreference"("profileId", "kind", "valueKey");

-- AddForeignKey
ALTER TABLE "SearchPreference" ADD CONSTRAINT "SearchPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
