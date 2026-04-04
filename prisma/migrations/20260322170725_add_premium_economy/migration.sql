/*
  Warnings:

  - You are about to drop the column `canonicalPositionId` on the `JobApplication` table. All the data in the column will be lost.
  - You are about to drop the `CanonicalPosition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MappingSuggestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PositionAlias` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Sector` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('COIN', 'GEM');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('SUBSCRIPTION_GRANT', 'USAGE', 'QUEST_REWARD', 'PURCHASE', 'EXPIRATION', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATE_POSTULATION', 'IMPROVE_CV', 'GENERATE_COVER_LETTER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "CanonicalPosition" DROP CONSTRAINT "CanonicalPosition_sectorId_fkey";

-- DropForeignKey
ALTER TABLE "JobApplication" DROP CONSTRAINT "JobApplication_canonicalPositionId_fkey";

-- DropForeignKey
ALTER TABLE "MappingSuggestion" DROP CONSTRAINT "MappingSuggestion_userId_fkey";

-- DropForeignKey
ALTER TABLE "PositionAlias" DROP CONSTRAINT "PositionAlias_canonicalPositionId_fkey";

-- AlterTable
ALTER TABLE "JobApplication" DROP COLUMN "canonicalPositionId";

-- DropTable
DROP TABLE "CanonicalPosition";

-- DropTable
DROP TABLE "MappingSuggestion";

-- DropTable
DROP TABLE "PositionAlias";

-- DropTable
DROP TABLE "Sector";

-- DropEnum
DROP TYPE "SuggestionStatus";

-- DropEnum
DROP TYPE "SuggestionType";

-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "subscriptionExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinBucket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "remainingAmount" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenType" "TokenType" NOT NULL,
    "direction" "Direction" NOT NULL,
    "coinsDelta" INTEGER NOT NULL DEFAULT 0,
    "gemsDelta" INTEGER NOT NULL DEFAULT 0,
    "reason" "LedgerReason" NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "bucketId" TEXT,
    "balanceAfterCoins" INTEGER NOT NULL DEFAULT 0,
    "balanceAfterGems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ActionType" NOT NULL,
    "providerUsed" TEXT,
    "coinsConsumed" INTEGER NOT NULL DEFAULT 0,
    "gemsConsumed" INTEGER NOT NULL DEFAULT 0,
    "coinsBefore" INTEGER,
    "coinsAfter" INTEGER,
    "gemsBefore" INTEGER,
    "gemsAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "provider" TEXT NOT NULL,
    "providerTxId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "coinsGranted" INTEGER NOT NULL DEFAULT 0,
    "gemsGranted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rewardGems" INTEGER NOT NULL,
    "conditionType" "ActionType" NOT NULL,
    "conditionValue" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserQuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Balance_userId_key" ON "Balance"("userId");

-- CreateIndex
CREATE INDEX "CoinBucket_userId_expiresAt_idx" ON "CoinBucket"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "TokenLedger_userId_idx" ON "TokenLedger"("userId");

-- CreateIndex
CREATE INDEX "TokenLedger_tokenType_idx" ON "TokenLedger"("tokenType");

-- CreateIndex
CREATE INDEX "TokenLedger_reason_idx" ON "TokenLedger"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "TokenLedger_referenceType_referenceId_key" ON "TokenLedger"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "UsageLog_userId_idx" ON "UsageLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerTxId_key" ON "PaymentTransaction"("providerTxId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_userId_idx" ON "PaymentTransaction"("userId");

-- CreateIndex
CREATE INDEX "UserQuest_userId_idx" ON "UserQuest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuest_userId_questId_key" ON "UserQuest"("userId", "questId");

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinBucket" ADD CONSTRAINT "CoinBucket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenLedger" ADD CONSTRAINT "TokenLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuest" ADD CONSTRAINT "UserQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuest" ADD CONSTRAINT "UserQuest_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
