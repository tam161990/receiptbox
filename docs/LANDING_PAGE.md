# ReceiptBox LV — Landing Page (V3)

## Purpose

The public landing at `/` explains the product emotionally before asking anyone to sign in.

**V3 goal:** feel friendly, alive, warm, playful, and modern — like Duolingo, Monzo, or Notion. **Not** corporate accounting software.

**Core emotion:** less stress, less chaos, more life.

---

## Route structure

| URL | Audience | Content |
|-----|----------|---------|
| `/` | Public | Landing V3 |
| `/login` | Public | Standalone login |
| `/dashboard` | Authenticated | App home |

Login from the landing opens a **modal** with `LoginForm` (Telegram ID). `/?login=1` opens it immediately.

---

## Visual rhythm (section colors)

Each major section uses a **subtle** background tone so blocks don't blend together. No strong color blocks.

| Section | Background | Component |
|---------|------------|-----------|
| Hero | `bg-white` | `HeroSection.tsx` |
| Story cards | `bg-blue-50` | `StoryCardsSection.tsx` |
| How it works | `bg-slate-50` | `HowItWorksSection.tsx` |
| Benefits | `bg-amber-50` | `BenefitsSection.tsx` |
| Privacy | `bg-emerald-50` | `PrivacySection.tsx` |
| Screenshots | `bg-indigo-50` | `ScreenshotsSection.tsx` |
| Founder beta | `bg-orange-50` | `BetaSection.tsx` |
| FAQ | `bg-white` | `FaqSection.tsx` |
| Final CTA | gradient `brand-600 → brand-300` | `FinalCtaSection.tsx` |

**Spacing:** `py-10` mobile, `py-14` desktop (via `SectionShell`, `HeroSection`, `FinalCtaSection`).

**Decorators:** soft gradient blobs, floating dots, minimal wave SVG at section bottom (`SectionShell.tsx`).

---

## PNG assets

| File | Placement |
|------|-----------|
| `public/landing/hero_girl2.png` | Hero — right on desktop, below copy on mobile |
| `public/landing/security1.png` | Hero feature card 1 (2:1 wide banner) |
| `public/landing/community1.png` | Hero feature card 2 (2:1 wide banner) |
| `public/landing/stress1.png` | Hero feature card 3 (2:1 wide banner) |
| `public/landing/story-1…4.png` | Story section (4 separate cards, never combined) |

### Hero feature cards (under hero)

Desktop: 3 columns. Mobile: stacked.

Text and icons are baked into the PNG assets — no separate microcopy below cards.

Animation: fade-up with delays 100 / 200 / 300 ms. Hover: `scale(1.03)` + stronger shadow. Cards use `aspect-[2/1]` with `object-cover`.

---

## Founder / beta section

Messaging hierarchy (value before price):

1. **Beta is free** — highlighted badge “BEZ MAKSAS BETA PERIODĀ”, orange badge “Šobrīd: bezmaksas beta”, short explainer that no payment is required during beta.
2. **Founder benefits** — help shape the product, 50% future premium discount, early access.
3. **Future pricing** — “Pēc beta — īpaša cena uz mūžu” + Founder Beta / Founder cohort labels (not upfront payment).

CTA: “Pieteikties beta testam — bez maksas”.

## Icon philosophy

- **Primary UI icons:** [`lucide-react`](https://lucide.dev) — consistent, modern, not childish.
- **Emoji:** secondary playful accent only (story labels, floating decor, one-line copy).
- Examples: Hero uses `Sparkles`, `Smartphone`, `FileText`; Benefits uses `Coffee`, `TrendingDown`; Privacy uses `Shield`, `Lock`; FAQ uses `HelpCircle`; Beta uses `Heart`, `Rocket`.

---

## Story cards

Section title: **No čeku haosa līdz mieram**

Playful labels:

| Card | Label |
|------|-------|
| 1 | 😵 PIRMS |
| 2 | 📦 RECEIPTBOX |
| 3 | ☕ MIERS |
| 4 | 😄 NĀKOTNES TU |

**Arrows:** `ArrowRight` on desktop (animated pulse), `ArrowDown` on mobile.

**Layout:**

| Breakpoint | Layout |
|------------|--------|
| `< md` | Vertical stack + ↓ arrows |
| `md–lg` | 2-column grid |
| `lg+` | Single row + → arrows |

---

## Animations (Framer Motion)

Library: `framer-motion`. Shared helpers: `src/components/landing/landingMotion.tsx`.

| Element | Animation |
|---------|-----------|
| Hero copy | fade + slide from left |
| Hero illustration | fade + slide up; floating ✨ ✓ 📄 ★ |
| Section content | `FadeUp` on scroll (once) |
| Feature cards | fade-up + hover scale |
| Story arrows | gentle pulse loop |
| Screenshot cards | hover lift (`y: -6`) |
| Buttons | `whileHover scale(1.02)` |
| Final CTA | floating receipt / check / star icons |

**Rule:** subtle only — no aggressive motion.

---

## Screenshots section

- Desktop: responsive grid; click opens modal.
- Mobile: carousel with chevron nav + dots; tap opens modal.
- Mockups: phone / browser / card frames (CSS placeholders until real screenshots).

---

## Cookie consent

`CookieConsent.tsx` — bottom banner, Pieņemt / Noraidīt, link to `/#privacy`.

---

## Key files

```
src/components/landing/
  LandingPage.tsx
  HeroSection.tsx
  SectionShell.tsx
  landingMotion.tsx
  StoryCardsSection.tsx
  HowItWorksSection.tsx
  BenefitsSection.tsx
  PrivacySection.tsx
  ScreenshotsSection.tsx
  BetaSection.tsx
  FaqSection.tsx
  FinalCtaSection.tsx
  LoginModal.tsx
src/components/CookieConsent.tsx
public/landing/*.png
```

---

## Future work

- Telegram Login Widget in modal
- Dedicated beta waitlist form
- Public full `/privacy` page without auth
- Replace screenshot mockups with real product captures
