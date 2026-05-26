# ReceiptBox — Railway + Cloudflare

Production domain: **https://receiptbox.online**

Stack:

```
User → Cloudflare (DNS, SSL, CDN) → Railway (Next.js + SQLite volume)
```

---

## 1. Railway project

1. Open [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select the `tam161990/receiptbox` repository
3. Railway auto-detects Next.js via `railway.toml` and `npm run build`

---

## 2. Persistent volume (SQLite + temp uploads)

1. In Railway service → **Volumes** → **Add Volume**
2. Mount path: `/data`
3. Size: 1 GB is enough for beta

---

## 3. Environment variables

In Railway → **Variables**:

| Variable | Value |
|----------|--------|
| `DATA_DIR` | `/data` |
| `DATABASE_URL` | `file:/data/prod.db` |
| `APP_URL` | `https://receiptbox.online` |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY` | your key |
| `OPENAI_MODEL` | `gpt-4o-mini` (optional) |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | long random string |
| `DEV_LOGIN_PIN` | leave **empty** |

Do **not** commit `.env` to git.

On each deploy, `npm start` runs `prisma migrate deploy` then `next start`.

---

## 4. Custom domain on Railway

1. Railway service → **Settings** → **Networking** → **Custom Domain**
2. Add `receiptbox.online` and `www.receiptbox.online`
3. Railway shows a target hostname (e.g. `xxxx.up.railway.app`)

---

## 5. Cloudflare DNS

In Cloudflare → **DNS** for `receiptbox.online`:

**Remove** parking records:

- A → `192.64.119.46`
- CNAME `www` → `parkingpage.namecheap.com`

**Add** (use Railway's hostname):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `xxxx.up.railway.app` | Proxied |
| CNAME | `www` | `xxxx.up.railway.app` | Proxied |

Keep **MX** and **TXT** (email forwarding) if you use Namecheap email.

**SSL/TLS** → **Full** (recommended with Cloudflare proxy).

---

## 6. Telegram webhook

After the site is live:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://receiptbox.online/api/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "edited_message", "callback_query"]
  }'
```

Verify:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

BotFather:

```
/setdomain
→ your bot
→ receiptbox.online
```

Bot photo (optional):

```bash
npm run icons:generate
npm run telegram:set-photo
```

---

## 7. Smoke test

- [ ] https://receiptbox.online — landing loads
- [ ] Login / dashboard works
- [ ] Telegram `/start` — onboarding messages
- [ ] Send a PDF to the bot — document appears in dashboard
- [ ] PWA icon on mobile (optional)

---

## 8. Local production-like run

```bash
mkdir -p /tmp/receiptbox-data/uploads
export DATA_DIR=/tmp/receiptbox-data
export DATABASE_URL="file:/tmp/receiptbox-data/prod.db"
npm run build
npm start
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on Prisma | Check `postinstall` runs; logs should show `prisma generate` |
| DB empty after redeploy | Volume not mounted — check `DATA_DIR` and `/data` volume |
| Telegram webhook 403 | `TELEGRAM_WEBHOOK_SECRET` mismatch between Railway and `setWebhook` |
| Bot silent, webhook 200 | `TELEGRAM_BOT_TOKEN` must be **full** `123456789:ABC...` from BotFather, not only the part after `:` |
| Bot silent, `botTokenValid: true` | Database broken — `GET /api/telegram/webhook` → `databaseOk: false`. Add Railway **Volume** at `/data`, set `DATA_DIR=/data` and `DATABASE_URL=file:/data/prod.db`, redeploy |
| Check bot token on server | `GET https://receiptbox.online/api/telegram/webhook` → `config.botTokenValid: true` and `config.databaseOk: true` |
| 502 from Cloudflare | Railway service not running — check deploy logs |
| Cookie login fails | `APP_URL` must match public URL; `secure` cookies need HTTPS |

---

## Next steps (not blocking beta)

- Telegram Login Widget (replace manual Telegram ID)
- PostgreSQL instead of SQLite
- Cloudflare R2 for uploads
