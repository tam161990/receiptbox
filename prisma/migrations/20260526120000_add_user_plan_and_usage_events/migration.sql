-- Plan / monetization fields on User (were in schema but never migrated).
ALTER TABLE "User" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LV';
ALTER TABLE "User" ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'beta';
ALTER TABLE "User" ADD COLUMN "planStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "foundingJoinedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "isFoundingUser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "foundingDiscountPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "foundingFeatureSnapshotJson" TEXT;
ALTER TABLE "User" ADD COLUMN "betaUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "featuresJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "monthlyDocumentLimit" INTEGER NOT NULL DEFAULT 999999;
ALTER TABLE "User" ADD COLUMN "monthlyAiQuestionsLimit" INTEGER NOT NULL DEFAULT 999999;
ALTER TABLE "User" ADD COLUMN "documentsProcessedCurrentMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "aiQuestionsCurrentMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastUsageResetAt" DATETIME;

-- Usage analytics table (was in schema but never migrated).
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");
CREATE INDEX "UsageEvent_userId_eventType_idx" ON "UsageEvent"("userId", "eventType");
