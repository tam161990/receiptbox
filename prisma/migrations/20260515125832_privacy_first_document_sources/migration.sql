-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFilePath" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "telegramFileId" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileDeletedAt" DATETIME,
    "sourceType" TEXT NOT NULL DEFAULT 'unknown',
    "sourceHint" TEXT,
    "userSourceNote" TEXT,
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
    "lineItemsJson" TEXT,
    "totalAmountAttributed" REAL,
    "deductibleAmountAttributed" REAL,
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
INSERT INTO "new_Document" ("aiJson", "category", "confidenceScore", "createdAt", "currency", "deductibleAmount", "deductibleAmountAttributed", "deductiblePercent", "deductibleStatus", "documentDate", "documentNumber", "explanation", "fileSize", "id", "lineItemsJson", "mimeType", "needsReviewReasons", "netAmount", "originalFileName", "paymentDate", "rawExtractedText", "servicePeriodEnd", "servicePeriodStart", "status", "storedFilePath", "telegramFileId", "totalAmount", "totalAmountAttributed", "updatedAt", "uploadedAt", "userCategoryId", "userId", "vatAmount", "vendorName", "vendorRegistrationNumber") SELECT "aiJson", "category", "confidenceScore", "createdAt", "currency", "deductibleAmount", "deductibleAmountAttributed", "deductiblePercent", "deductibleStatus", "documentDate", "documentNumber", "explanation", "fileSize", "id", "lineItemsJson", "mimeType", "needsReviewReasons", "netAmount", "originalFileName", "paymentDate", "rawExtractedText", "servicePeriodEnd", "servicePeriodStart", "status", "storedFilePath", "telegramFileId", "totalAmount", "totalAmountAttributed", "updatedAt", "uploadedAt", "userCategoryId", "userId", "vatAmount", "vendorName", "vendorRegistrationNumber" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE INDEX "Document_userId_documentDate_idx" ON "Document"("userId", "documentDate");
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");
CREATE INDEX "Document_userCategoryId_idx" ON "Document"("userCategoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
