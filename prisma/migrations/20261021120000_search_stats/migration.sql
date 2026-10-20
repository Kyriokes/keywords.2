-- Estadísticas de la búsqueda: cada corrida y cada oferta que llegó de un portal, se haya quedado en la cola o no. Tablas nuevas; no toca datos existentes.
-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL,
    "fetched" INTEGER NOT NULL,
    "fresh" INTEGER NOT NULL,
    "matchedRole" INTEGER NOT NULL,
    "filtered" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "deferred" INTEGER NOT NULL DEFAULT 0,
    "bySource" JSONB NOT NULL,
    "errors" TEXT[],
    "profileId" TEXT NOT NULL,

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestedOffer" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "board" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "location" TEXT,
    "url" TEXT NOT NULL,
    "roleName" TEXT,
    "seniority" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "score" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesSeen" INTEGER NOT NULL DEFAULT 1,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "IngestedOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchRun_profileId_startedAt_idx" ON "SearchRun"("profileId", "startedAt");

-- CreateIndex
CREATE INDEX "IngestedOffer_profileId_firstSeenAt_idx" ON "IngestedOffer"("profileId", "firstSeenAt");

-- CreateIndex
CREATE INDEX "IngestedOffer_profileId_lastSeenAt_idx" ON "IngestedOffer"("profileId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestedOffer_profileId_externalId_key" ON "IngestedOffer"("profileId", "externalId");

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestedOffer" ADD CONSTRAINT "IngestedOffer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

