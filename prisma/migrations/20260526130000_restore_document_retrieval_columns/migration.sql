-- privacy_first_document_sources recreated Document without retrieval columns added earlier.
ALTER TABLE "Document" ADD COLUMN "retrievalLocation" TEXT;
ALTER TABLE "Document" ADD COLUMN "retrievalCustomNote" TEXT;
