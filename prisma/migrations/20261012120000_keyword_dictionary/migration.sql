-- AlterTable
ALTER TABLE "Keyword" ADD COLUMN "displayName" TEXT,
ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "source" TEXT;

-- AlterTable
ALTER TABLE "KeywordAlias" ADD COLUMN "exactText" TEXT;
