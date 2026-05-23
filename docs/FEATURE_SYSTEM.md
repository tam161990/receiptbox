# Feature System

## Overview

ReceiptBox uses **feature-based permissions** instead of hard-coded plan checks scattered across the codebase.

```typescript
// ❌ Avoid
if (user.plan === "pro") { ... }

// ✅ Prefer
if (canUseFeature(user, "ASK_AI")) { ... }
```

## Feature Enum

Defined in `src/lib/features.ts`:

| Feature | Description |
| --- | --- |
| `DOCUMENT_UPLOAD_WEB` | Web panel upload |
| `DOCUMENT_UPLOAD_TELEGRAM` | Telegram bot upload |
| `ASK_AI` | Per-document AI Q&A |
| `CSV_EXPORT` | CSV export |
| `XLSX_EXPORT` | Excel export |
| `DOCUMENT_REANALYZE` | Re-run AI analysis |
| `YEAR_SUMMARY` | Annual report |
| `QUARTER_SUMMARY` | Quarterly report |
| `SMART_WARNINGS` | Future: proactive alerts |
| `ADVANCED_AI_ASSISTANT` | Future: enhanced AI |
| `ACCOUNTANT_MODE` | Future: accountant workflow |
| `PRIORITY_PROCESSING` | Future: faster queue |
| `MULTI_CLIENT_DASHBOARD` | Future: multi-client view |

## PLAN_FEATURES Mapping

Each `PlanType` maps to an array of enabled features:

| Plan | Current mapping |
| --- | --- |
| `beta` | All features |
| `founder` | All current features |
| `free` | Empty (not used yet) |
| `unlimited` | Empty (not used yet) |
| `pro` | Empty (not used yet) |
| `accountant` | Export + reports + accountant features |

## `canUseFeature(user, feature)`

Evaluation order (when enforcement is enabled):

1. If `ENFORCE_FEATURE_GATES === false` → **always true** (current production behavior)
2. Plan status suspended/expired → deny
3. Founder snapshot contains feature → allow
4. Plan's `PLAN_FEATURES` includes feature → allow
5. Per-user `featuresJson` override → allow/deny
6. Otherwise → deny

## Founder Lifetime Features

`userHasLifetimeFounderFeature(user, feature)` checks `foundingFeatureSnapshotJson`.

Founders keep features that existed at join time **forever**, even if their plan changes later.

## Future Lock Strategy

Features should **not disappear** from the UI. Locked features should:

- Remain **visible**
- Show `featureLockMessage(feature)` (Latvian copy prepared)
- Not block unrelated workflows

Examples:

| Feature | Lock message |
| --- | --- |
| `ASK_AI` | Pieejams PRO |
| `SMART_WARNINGS` | Jauna Premium funkcija |
| `ADVANCED_AI_ASSISTANT` | Pieejams Premium |

**Lock messages are not displayed yet.**

## Per-User Overrides

`featuresJson` on the User model allows manual grants:

```json
{ "ASK_AI": true, "SMART_WARNINGS": false }
```

Useful for support, beta testers, and accountants.
