# Founder Program

## Who Are Founders?

Founder users are **not** free-tier users. They are early adopters who:

- Test the product in real declaration workflows
- Provide feedback via Telegram and support channels
- Help shape categories, AI prompts, and UX

## Founder Rights

| Right | Description |
| --- | --- |
| Unlimited current functionality | No document or AI question caps while on founder plan |
| Lifetime feature snapshot | Permanent access to features existing at join time |
| 50% future discount | On premium features launched after joining |
| Lifetime pricing | €29/year (future billing, not active today) |

## `foundingFeatureSnapshotJson`

When a user becomes a founder, we store a JSON array of feature codes available at that moment.

**Example:**

```json
[
  "DOCUMENT_UPLOAD_WEB",
  "DOCUMENT_UPLOAD_TELEGRAM",
  "ASK_AI",
  "CSV_EXPORT",
  "XLSX_EXPORT",
  "YEAR_SUMMARY",
  "QUARTER_SUMMARY",
  "DOCUMENT_REANALYZE"
]
```

### Why a Snapshot?

- Features shipped **before** founder join → always allowed (`userHasLifetimeFounderFeature`)
- Features shipped **after** founder join → subject to plan / discount rules
- Prevents "lifetime everything" promise that blocks future revenue

## Helper Functions

| Function | File | Purpose |
| --- | --- | --- |
| `buildFoundingFeatureSnapshot()` | `features.ts` | Create snapshot from current shipped features |
| `userHasLifetimeFounderFeature(user, feature)` | `features.ts` | Check snapshot membership |
| `upsertUserByTelegramId()` | `founders.ts` | Signup + auto cohort enrollment |
| `resolveFounderCohortByUserIndex()` | `founders.ts` | Map signup index → cohort |
| `enrollFoundingUser()` | `founders.ts` | Manual founder override (support) |

## Enrollment (Automatic)

On **first signup** (web login modal, `/login`, or Telegram bot), `upsertUserByTelegramId()` in `src/lib/founders.ts`:

1. Counts existing users inside a transaction (prevents race on cohort slots)
2. Resolves cohort via `resolveFounderCohortByUserIndex()` + `FOUNDER_COHORT_RULES`
3. Sets founder fields for users in slots **0–299**; user **300+** stays on default `beta`

| Signup index | Cohort | Fields set |
| --- | --- | --- |
| 0–99 | Founder Beta | `isFoundingUser`, `planType: founder`, snapshot, 50% discount, `featuresJson.founderCohort: "founderBeta"` |
| 100–299 | Founder | Same, `founderCohort: "founder"` |
| 300+ | Standard beta | Default plan fields only |

**Backfill:** Existing users who are not yet founders get enrolled on next login if their signup index qualifies.

**Manual override:** `enrollFoundingUser({ userId })` still available for support.

Feature gates remain off (`ENFORCE_FEATURE_GATES = false`) — flags are stored for future billing and UI.

## Cohort Rules

See `FOUNDER_COHORT_RULES` in `src/lib/plans.ts`:

- **0–100:** Founder Beta (initially free)
- **100–300:** Founder at €29/year
- **300+:** Standard future plans

Cohorts are assigned automatically on signup. Billing and feature gates are not enforced yet.
