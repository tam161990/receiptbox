# ReceiptBox Branding Assets

## Base icon

`base-icon.svg` — shared icon for all countries:

- Blue open box
- White receipt with lines
- Green checkmark
- No text, no country letters

## Country badges (optional corner overlay)

| File | Flag |
| --- | --- |
| `badges/lv.svg` | Latvia (maroon-white-maroon) |
| `badges/lt.svg` | Lithuania (yellow-green-red) |
| `badges/ee.svg` | Estonia (blue-black-white) |

Badges are removable — base icon works standalone at 16×16 through 512×512.

## PWA app icon

Source: `lv-app-icon.svg` (box + receipt + checkmark + LV flag badge).

Outputs: `/public/icons/*` — home screen, PWA manifest.

## Telegram bot icon

Same artwork as PWA: `public/icons/telegram-bot-photo.png` (640×640).

- `/start` sends this image with the welcome message.
- Profile photo: `npm run telegram:set-photo` (uses `setMyProfilePhoto` API).

## Web header logo

Source: `receiptbox-lv-web-logo.svg` (icon + ReceiptBox + red LV).

Outputs: `/public/branding/receiptbox-lv-logo.svg` — NavBar, login page.

Transparent background for white UI.

## Regenerate all PNGs

```bash
npm run icons:generate
```
