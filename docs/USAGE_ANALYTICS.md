# Usage Analytics

## Purpose

Track how users interact with ReceiptBox **before** introducing limits or pricing. Data supports:

- Pricing decisions (which features correlate with retention?)
- Power user identification
- Upload channel mix (Telegram vs web)
- Export and report frequency

## User-Level Counters

Stored on the `User` model:

| Field | Incremented when |
| --- | --- |
| `documentsProcessedCurrentMonth` | Document upload (web or Telegram), including bank statement splits |
| `aiQuestionsCurrentMonth` | Ask AI question submitted |
| `lastUsageResetAt` | Updated when calendar month rolls over |

Default limits are `999999` — **not enforced**.

## Event Log

Granular events stored in `UsageEvent`:

| eventType | Trigger |
| --- | --- |
| `document_upload_web` | POST `/api/documents/upload` |
| `document_upload_telegram` | Telegram webhook file handler |
| `ask_ai` | POST `/api/documents/[id]/ask` |
| `document_reanalyze` | POST `/api/documents/[id]/analyze` |
| `report_generation` | GET `/api/reports` |
| `csv_export` | GET `/api/export/csv` |
| `xlsx_export` | GET `/api/export/xlsx` |

Each event may include JSON `metadata` (year, quarter, document IDs, source).

## `trackUsage()`

Located in `src/lib/usage.ts`.

- Resets monthly counters when UTC month changes
- Increments relevant counters
- Creates `UsageEvent` row
- Failures are logged, not thrown (upload/ask flows must not break)

## Why Limits Are NOT Enforced Yet

1. Need baseline usage data first
2. Early users should not hit arbitrary caps
3. Founder promise includes unlimited current usage
4. Enforcement requires UI for upgrades (`ENFORCE_FEATURE_GATES`)

When ready:

1. Set realistic `monthlyDocumentLimit` / `monthlyAiQuestionsLimit` per plan
2. Enable `ENFORCE_FEATURE_GATES`
3. Check counters in API routes before processing
4. Show upgrade paths (not built yet)

## Future Analytics Goals

- Cohort retention by plan type
- Telegram-first vs web-first users
- Documents per user per month distribution
- Ask AI adoption rate
- Export frequency before declaration deadlines

No dashboards exist yet — query via Prisma Studio or SQL.
