-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HUNTER', 'RECRUITER', 'BUSINESS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'HUNTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "CV" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "CV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "link" TEXT,
    "jobTitle" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "profileId" TEXT NOT NULL,
    "positionId" TEXT,
    "cvId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordAlias" (
    "id" TEXT NOT NULL,
    "aliasText" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,

    CONSTRAINT "KeywordAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CVKeyword" (
    "cvId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,

    CONSTRAINT "CVKeyword_pkey" PRIMARY KEY ("cvId","keywordId")
);

-- CreateTable
CREATE TABLE "JobApplicationKeyword" (
    "jobApplicationId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,

    CONSTRAINT "JobApplicationKeyword_pkey" PRIMARY KEY ("jobApplicationId","keywordId")
);

-- CreateTable
CREATE TABLE "ProviderStats" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "generated" INTEGER NOT NULL DEFAULT 0,
    "accepted" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "ProviderStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "CV_profileId_idx" ON "CV"("profileId");

-- CreateIndex
CREATE INDEX "JobApplication_profileId_idx" ON "JobApplication"("profileId");

-- CreateIndex
CREATE INDEX "JobApplication_jobTitle_idx" ON "JobApplication"("jobTitle");

-- CreateIndex
CREATE INDEX "Position_title_idx" ON "Position"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Position_profileId_title_key" ON "Position"("profileId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_canonicalText_key" ON "Keyword"("canonicalText");

-- CreateIndex
CREATE INDEX "Keyword_canonicalText_idx" ON "Keyword"("canonicalText");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordAlias_aliasText_key" ON "KeywordAlias"("aliasText");

-- CreateIndex
CREATE INDEX "KeywordAlias_aliasText_idx" ON "KeywordAlias"("aliasText");

-- CreateIndex
CREATE INDEX "CVKeyword_keywordId_idx" ON "CVKeyword"("keywordId");

-- CreateIndex
CREATE INDEX "JobApplicationKeyword_keywordId_idx" ON "JobApplicationKeyword"("keywordId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderStats_profileId_provider_key" ON "ProviderStats"("profileId", "provider");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CV" ADD CONSTRAINT "CV_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordAlias" ADD CONSTRAINT "KeywordAlias_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CVKeyword" ADD CONSTRAINT "CVKeyword_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CVKeyword" ADD CONSTRAINT "CVKeyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicationKeyword" ADD CONSTRAINT "JobApplicationKeyword_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicationKeyword" ADD CONSTRAINT "JobApplicationKeyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderStats" ADD CONSTRAINT "ProviderStats_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
