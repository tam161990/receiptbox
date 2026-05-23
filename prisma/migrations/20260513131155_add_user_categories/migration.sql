-- AlterTable
ALTER TABLE "User" ADD COLUMN "categoryLabelsJson" TEXT;

-- CreateTable
CREATE TABLE "UserCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "parentCategory" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deductibleStatus" TEXT,
    "deductiblePercent" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFilePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "telegramFileId" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "documentDate" DATETIME,
    "paymentDate" DATETIME,
    "servicePeriodStart" DATETIME,
    "servicePeriodEnd" DATETIME,
    "vendorName" TEXT,
    "vendorRegistrationNumber" TEXT,
    "documentNumber" TEXT,
    "currency" TEXT,
    "netAmount" REAL,
    "vatAmount" REAL,
    "totalAmount" REAL,
    "category" TEXT,
    "deductibleStatus" TEXT,
    "deductiblePercent" REAL,
    "deductibleAmount" REAL,
    "userCategoryId" TEXT,
    "confidenceScore" REAL,
    "explanation" TEXT,
    "needsReviewReasons" TEXT,
    "rawExtractedText" TEXT,
    "aiJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_userCategoryId_fkey" FOREIGN KEY ("userCategoryId") REFERENCES "UserCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("aiJson", "category", "confidenceScore", "createdAt", "currency", "deductibleAmount", "deductiblePercent", "deductibleStatus", "documentDate", "documentNumber", "explanation", "fileSize", "id", "mimeType", "needsReviewReasons", "netAmount", "originalFileName", "paymentDate", "rawExtractedText", "servicePeriodEnd", "servicePeriodStart", "status", "storedFilePath", "telegramFileId", "totalAmount", "updatedAt", "uploadedAt", "userId", "vatAmount", "vendorName", "vendorRegistrationNumber") SELECT "aiJson", "category", "confidenceScore", "createdAt", "currency", "deductibleAmount", "deductiblePercent", "deductibleStatus", "documentDate", "documentNumber", "explanation", "fileSize", "id", "mimeType", "needsReviewReasons", "netAmount", "originalFileName", "paymentDate", "rawExtractedText", "servicePeriodEnd", "servicePeriodStart", "status", "storedFilePath", "telegramFileId", "totalAmount", "updatedAt", "uploadedAt", "userId", "vatAmount", "vendorName", "vendorRegistrationNumber" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE INDEX "Document_userId_documentDate_idx" ON "Document"("userId", "documentDate");
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");
CREATE INDEX "Document_userCategoryId_idx" ON "Document"("userCategoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserCategory_userId_parentCategory_idx" ON "UserCategory"("userId", "parentCategory");

-- CreateIndex
CREATE UNIQUE INDEX "UserCategory_userId_parentCategory_name_key" ON "UserCategory"("userId", "parentCategory", "name");
