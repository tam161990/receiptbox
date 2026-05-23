-- AlterTable
ALTER TABLE "Document" ADD COLUMN "deductibleAmountAttributed" REAL;
ALTER TABLE "Document" ADD COLUMN "lineItemsJson" TEXT;
ALTER TABLE "Document" ADD COLUMN "totalAmountAttributed" REAL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "myIdentifiersJson" TEXT;
