-- AlterTable
ALTER TABLE "User" ADD COLUMN "categoryDefaultsJson" TEXT;
ALTER TABLE "User" ADD COLUMN "mainActivityDescription" TEXT;
ALTER TABLE "User" ADD COLUMN "selfEmployedType" TEXT;
ALTER TABLE "User" ADD COLUMN "workFromHomePercent" INTEGER;

-- CreateTable
CREATE TABLE "AiQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiQuestion_userId_createdAt_idx" ON "AiQuestion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiQuestion_documentId_idx" ON "AiQuestion"("documentId");
