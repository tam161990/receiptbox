-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramUserId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
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
    "confidenceScore" REAL,
    "explanation" TEXT,
    "needsReviewReasons" TEXT,
    "rawExtractedText" TEXT,
    "aiJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_userId_documentDate_idx" ON "Document"("userId", "documentDate");

-- CreateIndex
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");
