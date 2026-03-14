-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "originalPositionTitle" TEXT;

-- Update existing records
UPDATE "JobApplication"
SET "originalPositionTitle" = "Position"."title"
FROM "Position"
WHERE "JobApplication"."positionId" = "Position"."id";
