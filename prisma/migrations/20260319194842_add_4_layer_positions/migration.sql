-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('ALIAS_TO_CANONICAL', 'CANONICAL_TO_SECTOR');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "canonicalPositionId" TEXT;

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalPosition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sectorId" TEXT,

    CONSTRAINT "CanonicalPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionAlias" (
    "id" TEXT NOT NULL,
    "aliasText" TEXT NOT NULL,
    "canonicalPositionId" TEXT NOT NULL,

    CONSTRAINT "PositionAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingSuggestion" (
    "id" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL,
    "rawTitle" TEXT,
    "suggestedCanonicalId" TEXT,
    "proposedNewCanonical" TEXT,
    "targetCanonicalId" TEXT,
    "suggestedSectorId" TEXT,
    "proposedNewSector" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MappingSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sector_name_key" ON "Sector"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalPosition_name_key" ON "CanonicalPosition"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PositionAlias_aliasText_key" ON "PositionAlias"("aliasText");

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_canonicalPositionId_fkey" FOREIGN KEY ("canonicalPositionId") REFERENCES "CanonicalPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalPosition" ADD CONSTRAINT "CanonicalPosition_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAlias" ADD CONSTRAINT "PositionAlias_canonicalPositionId_fkey" FOREIGN KEY ("canonicalPositionId") REFERENCES "CanonicalPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingSuggestion" ADD CONSTRAINT "MappingSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
