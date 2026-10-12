-- AlterTable
ALTER TABLE "Statement" ADD COLUMN     "asOfDate" TIMESTAMP(3),
ADD COLUMN     "layoutVersion" TEXT,
ADD COLUMN     "pdfSha256" TEXT;
