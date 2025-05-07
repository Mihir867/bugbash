-- AlterTable
ALTER TABLE "RepositoryConfig" ADD COLUMN     "buildStatus" TEXT,
ADD COLUMN     "deploymentUrl" TEXT,
ADD COLUMN     "lastBuildId" TEXT,
ADD COLUMN     "lastBuildStartTime" TIMESTAMP(3);
