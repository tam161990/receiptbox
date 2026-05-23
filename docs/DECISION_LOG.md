# Decision Log

Chronological record of product and architecture decisions. **Future developers should append new entries.**

---

## 2025 — Do not store original files

**Decision:** Delete original uploads after AI extraction; store structured fields only.

**Reason:** Privacy and trust. Self-employed users fear document leaks. ReceiptBox must not become a document archive.

**Impact:** `storedFilePath` nullable; `fileDeletedAt` timestamp; re-analyze limited to retained text.

---

## 2025 — Telegram-first upload

**Decision:** Primary intake via Telegram bot; web panel for review and export.

**Reason:** Lowest friction for daily receipt capture on phone.

**Impact:** Shared `ingestUploadedFile()` pipeline for web and Telegram.

---

## 2026 — Founder model instead of freemium cuts

**Decision:** Use founder cohorts with lifetime snapshot + 50% future discount.

**Reason:** Reward early users without promising unlimited future features (monetization trap).

**Impact:** `foundingFeatureSnapshotJson`, `userHasLifetimeFounderFeature()`.

---

## 2026 — Feature gates over plan string checks

**Decision:** `canUseFeature(user, feature)` with `PLAN_FEATURES` mapping.

**Reason:** Scalable permissions; visible locked features; easier A/B and overrides.

**Impact:** `src/lib/features.ts`, `ENFORCE_FEATURE_GATES = false` until ready.

---

## 2026 — No enforcement during beta

**Decision:** All limits set to 999999; `canUseFeature` returns true for everyone.

**Reason:** Collect usage analytics first; avoid angering early adopters.

**Impact:** `trackUsage()` wired; limits checked nowhere yet.

---

## 2026 — Usage analytics before pricing

**Decision:** `UsageEvent` table + monthly counters on User.

**Reason:** Need data on upload volume, Ask AI adoption, exports before setting prices.

**Impact:** `src/lib/usage.ts` integrated into API routes.

---

## 2026 — Baltic multi-country architecture

**Decision:** Single codebase; `countryConfig` + provider interfaces; LV first.

**Reason:** LT and EE are natural expansion; avoid forked repos.

**Impact:** `src/config/countries.ts`, `User.countryCode`, `/assets/branding/`.

---

## 2026 — PWA instead of native mobile app

**Decision:** Manifest + mobile responsive UI + install hint; no App Store.

**Reason:** Faster to ship; Telegram-to-web flow; sufficient for MVP mobile use.

**Impact:** `/public/manifest.json`, mobile card layouts, sticky save bar.

---

## 2026 — Pricing kept intentionally low

**Decision:** Founder €29/year; Pro €89/year (future).

**Reason:** Small market; habit formation; compete with spreadsheets (free).

**Impact:** Documented in `PLAN_PRICING`; not displayed in UI.

---

## Template for new entries

```
## YYYY-MM — Title

**Decision:** ...

**Reason:** ...

**Impact:** ...
```
