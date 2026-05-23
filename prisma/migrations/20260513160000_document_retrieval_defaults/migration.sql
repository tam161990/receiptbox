-- AlterTable
ALTER TABLE "Document" ADD COLUMN "retrievalLocation" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "retrievalCustomNote" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "categoryRetrievalDefaultsJson" TEXT;
