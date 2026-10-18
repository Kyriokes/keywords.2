-- CreateTable
CREATE TABLE "JobSearchSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sources" TEXT[],
    "atsBoards" TEXT[],
    "minScore" INTEGER NOT NULL DEFAULT 40,
    "maxPerRun" INTEGER NOT NULL DEFAULT 10,
    "lastRunAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "JobSearchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobSearchSettings_profileId_key" ON "JobSearchSettings"("profileId");

-- AddForeignKey
ALTER TABLE "JobSearchSettings" ADD CONSTRAINT "JobSearchSettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

