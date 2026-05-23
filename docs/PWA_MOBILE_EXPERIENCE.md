# PWA & Mobile Experience

## Approach

ReceiptBox LV is **not** a native iOS/Android app.

It is a **mobile-friendly web app** with PWA install support:

- Add to home screen
- Standalone display mode
- Optimized touch targets and responsive layouts

## Benefits

| Benefit | Detail |
| --- | --- |
| Faster development | One web codebase |
| No App Store approval | Ship immediately |
| Telegram flow | Bot → mobile browser → dashboard link |
| Lower maintenance | No native release cycles |

## PWA Assets

| File | Purpose |
| --- | --- |
| `/public/manifest.json` | Web app manifest |
| `/public/icons/icon-192.png` | Android / general |
| `/public/icons/icon-512.png` | Splash / install |
| `/public/icons/apple-touch-icon.png` | iOS home screen |
| `/public/icons/telegram-bot-photo.png` | Telegram bot profile + `/start` welcome |
| `/assets/branding/base-icon.svg` | Source artwork (replace for final brand) |

**Note:** Current PNG icons are generated from placeholder artwork. Replace with final `base-icon.svg` export when design is finalized.

## Next.js Metadata

Configured in `src/app/layout.tsx`:

- `manifest`, `themeColor`, `viewport`
- `appleWebApp.capable`, `appleWebApp.title`
- `mobile-web-app-capable` meta tags

LV theme color: `#9C1B34`

## Mobile Layout Rules

| Route | Mobile behavior |
| --- | --- |
| `/documents` | Card list (hidden table on small screens) |
| `/documents/[id]` | Sticky save action bar |
| `/reports` | Summary cards first; document cards on mobile |
| `/profile` | Single column forms |
| `/login` | Centered card, full-width inputs |

Global:

- Buttons: `min-h-11` touch targets
- `pb-safe` for home indicator safe area
- Horizontal overflow avoided on tables via card fallbacks

## Install Hint

`PwaInstallHint` component on dashboard:

- Shown on mobile browsers only
- Dismissible → `localStorage` key `rblv_pwa_install_dismissed`
- iOS vs Android specific instructions (Latvian)

## Telegram → Web Flow

When `APP_URL` is set, bot messages include:

```
Atvērt vadības paneli: {APP_URL}/documents/{id}
```

Ensures phone users can jump from Telegram to mobile-friendly dashboard.

## Testing

### iPhone (Safari)

1. Open dashboard in Safari
2. Share → Add to Home Screen
3. Launch from icon — should open standalone
4. Verify document cards and save bar

### Android (Chrome)

1. Open dashboard
2. Menu → Install app / Add to Home screen
3. Verify manifest icons and theme color

### Dev tools

Chrome → Application → Manifest / Service Workers (no service worker yet — install via manifest only)

## Future

- Optional service worker for offline read-only cache
- Push notifications (declaration reminders)
- Native apps only if PWA limits are hit
