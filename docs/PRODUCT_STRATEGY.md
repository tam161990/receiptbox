# Product Strategy

## Mission

**"Vienkāršākais veids, kā sagatavot izdevumus deklarācijai."**

ReceiptBox LV helps Latvian self-employed users prepare expense data for tax declarations. It does **not** create or submit declarations — VID and existing tools already do that.

## What ReceiptBox Does

ReceiptBox helps users:

- **Collect** receipts, invoices, and bank payments (Telegram + web)
- **Categorize** expenses with AI assistance and manual review
- **Reduce tax burden** through proper expense tracking and deductible attribution
- **Avoid manual work** — no spreadsheets, no re-typing amounts from PDFs

## What ReceiptBox Does NOT Do

- File tax declarations
- Provide legal or accounting advice
- Store original document archives

## Core Philosophy

> ReceiptBox LV does NOT create declarations. VID already does that.

The product sits **before** declaration: organize, validate, export.

## Privacy-First Architecture

Trust is more important than OCR accuracy.

- Original files are **deleted after processing**
- Only **structured fields** are stored (amounts, dates, categories, vendor names)
- **No document archive** on ReceiptBox servers
- Users **keep originals** on their phone, email, or bank app

This builds long-term trust with self-employed users who handle sensitive financial data.

## Baltic-First, Single Codebase

Latvia launches first. Lithuania and Estonia are planned using shared infrastructure with country-specific rules layered on top (see [MULTI_COUNTRY_STRATEGY.md](./MULTI_COUNTRY_STRATEGY.md)).

## Future Monetization (Not Active)

Infrastructure exists for plans, features, and usage analytics. **Nothing is enforced today.** All current functionality remains free and unlimited. See [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md).

## Architecture Docs

| Document | Topic |
| --- | --- |
| [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md) | Pricing philosophy |
| [FOUNDER_PROGRAM.md](./FOUNDER_PROGRAM.md) | Early user rewards |
| [FEATURE_SYSTEM.md](./FEATURE_SYSTEM.md) | Feature gates |
| [USAGE_ANALYTICS.md](./USAGE_ANALYTICS.md) | Usage tracking |
| [MULTI_COUNTRY_STRATEGY.md](./MULTI_COUNTRY_STRATEGY.md) | LV / LT / EE expansion |
| [PWA_MOBILE_EXPERIENCE.md](./PWA_MOBILE_EXPERIENCE.md) | Mobile web app |
| [DECISION_LOG.md](./DECISION_LOG.md) | Chronological decisions |
