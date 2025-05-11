-- AlterTable
ALTER TABLE "RepositoryConfig" ADD COLUMN     "criticalVulns" INTEGER,
ADD COLUMN     "highVulns" INTEGER,
ADD COLUMN     "lastScanTime" TIMESTAMP(3),
ADD COLUMN     "securityReportUrl" TEXT,
ADD COLUMN     "securityStatus" TEXT;
