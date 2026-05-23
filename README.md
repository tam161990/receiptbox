# ReceiptBox LV

> **Vienkāršākais veids, kā sagatavot izdevumus deklarācijai.**

ReceiptBox LV ir Telegram bots + web vadības panelis Latvijas pašnodarbinātajiem.
Lietotājs visa gada laikā sūta čekus, rēķinus un PDF izdevumu dokumentus
Telegram botam. Ceturkšņa vai gada beigās lietotājs atver vadības paneli,
izvēlas periodu, pārbauda izdevumus un eksportē CSV vai XLSX.

> ⚠️ **Atruna:** ReceiptBox LV **nav** grāmatvedības vai nodokļu konsultāciju
> pakalpojums. Rezultāti ir tikai palīglīdzeklis izdevumu apkopošanai un tie
> jāpārbauda pirms iesniegšanas VID. Katra AI lēmuma rezultāts iekļauj
> pārliecības līmeni un paskaidrojumu.

---

## Funkcionalitāte (MVP)

- **Telegram bots** – pieņem PDF, JPG, JPEG, PNG, ekrānuzņēmumus un fotoattēlus
  ar čekiem. Atbild latviešu valodā ar īsu kopsavilkumu.
- **AI analīze (OpenAI)** – izvelk datumu, piegādātāju, summu, PVN, kategoriju
  un atskaitāmā izdevuma novērtējumu. Atgriež strukturētu JSON.
- **SQLite + Prisma** – glabā lietotājus un dokumentus. MVP vienkāršai
  instalēšanai.
- **Web vadības panelis** – dokumentu saraksts, filtri, manuāla labošana,
  ceturkšņa/gada pārskats un CSV/XLSX eksports.
- **Latviešu UI** – visi statusi, kategorijas un paziņojumi latviešu valodā.

---

## Tehnoloģiju steks

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [TailwindCSS](https://tailwindcss.com/)
- [Prisma ORM](https://www.prisma.io/) + SQLite (MVP)
- [OpenAI SDK](https://github.com/openai/openai-node) (`gpt-4o-mini` pēc noklusējuma)
- Telegram Bot API (webhook)
- [`xlsx`](https://github.com/SheetJS/sheetjs) Excel eksportam
- [Zod](https://zod.dev/) validācijai

---

## Direktoriju struktūra

```
prisma/
  schema.prisma          # SQLite shēma
src/
  app/
    (app)/               # Aizsargātas lapas (sākums, dokumenti, pārskats)
    api/                 # REST API maršruti
      auth/login | logout
      documents | upload | [id] | [id]/analyze
      reports
      export/csv | xlsx
      telegram/webhook
    login/               # MVP pieslēgšanās lapa
  components/            # NavBar, Disclaimer, StatusBadge
  lib/
    ai.ts                # OpenAI klients un strukturēts JSON
    auth.ts              # Cookie sesija
    dates.ts             # Latviešu datumu/summu formāti
    documents.ts         # Dokumentu apstrāde un serializēšana
    enums.ts             # Statusi, kategorijas, atskaitāmā statusa marķējumi
    export.ts            # CSV un XLSX
    prisma.ts            # Prisma klients
    reports.ts           # Pārskata aprēķins
    storage.ts           # Failu glabāšana lokāli
    telegram.ts          # Telegram API helperi un latviešu paziņojumi
storage/uploads/         # Lokāli saglabāti dokumenti (NEPIEKĻAUT git)
```

---

## Sākam

### 1. Prasības

- **Node.js 18+** (ieteicams 20 vai 22)
- npm
- (pēc izvēles) [ngrok](https://ngrok.com/) Telegram webhook testēšanai

### 2. Atkarību instalācija

```bash
npm install
```

### 3. Vides mainīgie

Nokopē `.env.example` uz `.env` un aizpildi:

```bash
cp .env.example .env
```

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_WEBHOOK_SECRET="random-32-char-string"
APP_URL="https://your-domain.example.com"
DEV_LOGIN_PIN=""
```

| Mainīgais | Apraksts |
| --- | --- |
| `DATABASE_URL` | Prisma datu bāzes savienojums. MVP: SQLite fails. |
| `OPENAI_API_KEY` | OpenAI atslēga. Bez tās dokumenti tiks atzīmēti kā "Jāpārbauda". |
| `OPENAI_MODEL` | (Pēc izvēles) modelis, piem., `gpt-4o-mini`. |
| `TELEGRAM_BOT_TOKEN` | Tokens no [@BotFather](https://t.me/BotFather). |
| `TELEGRAM_WEBHOOK_SECRET` | Drošības marķieris, ko Telegram sūta `X-Telegram-Bot-Api-Secret-Token` virsrakstā. |
| `APP_URL` | Publiskā URL, kur darbojas šī lietotne (izmanto Telegram webhook). |
| `DEV_LOGIN_PIN` | (Pēc izvēles) ja iestatīts, pieslēgšanās formā tiek prasīts šis PIN. |

### 4. Datu bāzes migrēšana

```bash
npx prisma migrate dev --name init
# vai, lai vienkārši uzliktu shēmu bez migrāciju vēstures:
npx prisma db push
```

Prisma klients tiek ģenerēts automātiski (`postinstall` skripts).

### 5. Palaišana

```bash
npm run dev
```

Atver [http://localhost:3000](http://localhost:3000).

---

## Telegram bota iestatīšana

### 1. Izveido botu ar BotFather

1. Telegram lietotnē atver [@BotFather](https://t.me/BotFather)
2. Sūti `/newbot` un seko norādēm
3. Saglabā tokenu `TELEGRAM_BOT_TOKEN` failā `.env`
4. Ģenerē ikonas un iestati bota profila bildi (tā pati kā telefona/PWA ikona):

```bash
npm run icons:generate
npm run telegram:set-photo
```

Ja `setMyProfilePhoto` API nav pieejams tavā Telegram versijā, augšupielādē `public/icons/telegram-bot-photo.png` manuāli ar BotFather komandu `/setuserpic`.

### 2. Lokāla testēšana ar ngrok

Telegram pieprasa publisku HTTPS URL. Izmanto ngrok:

```bash
ngrok http 3000
```

Skopē izveidoto URL, piem., `https://abcd-12-34-56-78.ngrok-free.app`, un
ieliec to `APP_URL` mainīgajā.

### 3. Webhook reģistrēšana

Aizstāj `<TOKEN>`, `<APP_URL>` un `<SECRET>`:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<APP_URL>/api/telegram/webhook",
    "secret_token": "<SECRET>",
    "allowed_updates": ["message", "edited_message", "callback_query"]
  }'
```

Pārbaude:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### 4. Lietošana

1. Atver savu botu Telegramā un sūti `/start`.
2. Sūti `/id`, lai uzzinātu savu Telegram lietotāja ID.
3. Sūti čekus, rēķinus vai PDF dokumentus — bots atbildēs latviski.
4. Atver web vadības paneli un ielogojies ar to pašu Telegram ID.

---

## Web vadības panelis

- `/login` – ievadi Telegram lietotāja ID (un PIN, ja iestatīts)
- `/` – kopsavilkums un jaunākie dokumenti
- `/documents` – pilns dokumentu saraksts ar filtriem un manuālu augšupielādi
- `/documents/[id]` – detalizēta lapa ar AI rezultātiem un labošanas formu
- `/reports` – ceturkšņa/gada pārskats, kategoriju kopsavilkums, CSV/XLSX
  eksports

---

## API maršruti

| Metode | Ceļš | Apraksts |
| --- | --- | --- |
| `POST` | `/api/telegram/webhook` | Telegram update saņemšana |
| `POST` | `/api/auth/login` | Pieslēgties ar Telegram ID |
| `POST` | `/api/auth/logout` | Iziet |
| `POST` | `/api/documents/upload` | Augšupielādēt failu no UI |
| `POST` | `/api/documents/[id]/analyze` | Atkārtoti analizēt dokumentu |
| `GET`  | `/api/documents` | Saraksts ar filtriem |
| `GET`  | `/api/documents/[id]` | Viens dokuments |
| `PATCH`| `/api/documents/[id]` | Labot izvilktos laukus |
| `GET`  | `/api/reports?year=2026&quarter=Q1` | Pārskata dati JSON |
| `GET`  | `/api/export/csv?year=2026&quarter=Q1` | CSV eksports |
| `GET`  | `/api/export/xlsx?year=2026&quarter=Q1` | XLSX eksports |

`quarter` vērtības: `Q1`, `Q2`, `Q3`, `Q4`, `ALL` (vai bez parametra = viss gads).

---

## Komandas

```bash
npm install                # instalē atkarības
npm run dev                # palaiž dev serveri
npm run build              # produkcijas build
npm start                  # palaiž produkcijas build
npm run db:migrate         # prisma migrate dev
npm run db:push            # uzliek shēmu bez migrāciju vēstures
npm run db:studio          # atver Prisma Studio
```

Prasītās komandas darbojas:

- `npm install`
- `npx prisma migrate dev`
- `npm run dev`
- `npm run build`

---

## Apstrādes loģika (MVP)

- Ja dokumentā nav datuma → statuss `needs_review`.
- Ja nav kopējās summas → `needs_review`.
- Ja `confidenceScore < 0.7` → `needs_review`.
- Ja kategorija ir `unknown` → `needs_review`.
- AI nedrīkst izdomāt vērtības — trūkstoši lauki tiek atstāti `null`.
- Kategorijām `software`, `internet`, `telecom`, `office_supplies`,
  `professional_services`, `bank_fees`, `advertising` atskaitāmā statuss var
  būt `yes`, ja biznesa nozīme ir skaidra.
- Kategorijām `fuel`, `rent`, `electricity`, `telecom`, `internet`,
  `transport` atskaitāmā statuss var būt `partial`, ja iespējams jaukts
  personīgs/darba lietojums.
- Ēdināšanai (`food`) — pēc noklusējuma `unknown` / `needs_review`, ja
  konteksts nav skaidri biznesa.
- `deductibleAmount = totalAmount * deductiblePercent / 100`, ja procents
  zināms.
- Ja `deductibleStatus = "yes"`, `deductiblePercent` parasti tiek iestatīts uz
  100.
- Visi juridiskie/nodokļu skaidrojumi ir piesardzīgi un bez absolūtām
  garantijām.

---

## Drošība un privātums

- API atslēgas tiek glabātas tikai `.env` failā.
- `.env.example` ir publiskots; reālus mainīgos NEGLABĀ git repo.
- `storage/uploads/` ir iekļauts `.gitignore` — lietotāju faili nekad netiek
  commited.
- Dokumentu saturs netiek logots.
- Visi API maršruti (izņemot `/api/telegram/webhook` un `/api/auth/login`)
  pārbauda sesiju.
- Telegram webhook pārbauda `X-Telegram-Bot-Api-Secret-Token` virsrakstu.

---

## Izvietošana

### Vercel

1. Importē repo Vercel projektu pārvaldnieka panelī.
2. Iestati vides mainīgos.
3. Vercel automātiski palaiž `npm run build` (kas ietver `prisma generate`).
4. SQLite **nav** ieteicams Vercel produkcijai (failu sistēma ir
   pārejoša). Migrē uz PostgreSQL (`@vercel/postgres`, Neon, Supabase).

### Render / Railway

1. Izveido jaunu Node.js servisu.
2. Build komanda: `npm run build`. Start komanda: `npm start`.
3. SQLite darbojas, ja izvēlies persistent disku. Citādi migrē uz PostgreSQL.
4. Iestati visus vides mainīgos.

### Pāreja uz PostgreSQL produkcijai

1. Atjauno `prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Iestati `DATABASE_URL` uz PostgreSQL savienojumu.
3. `npx prisma migrate deploy`.

---

## Future architecture

ReceiptBox LV includes **infrastructure-only** foundations for monetization, segmentation, and multi-country expansion. **Nothing is enforced yet** — all features remain fully available.

| Area | Location | Status |
| --- | --- | --- |
| User plans | `prisma/schema.prisma` → `planType`, `planStatus`, … | Defaults: `beta` / `active` |
| Feature gates | `src/lib/features.ts` → `canUseFeature()` | Always returns `true` today |
| Founder snapshots | `foundingFeatureSnapshotJson` | Auto on signup (first 300 users) |
| Usage tracking | `src/lib/usage.ts` → `trackUsage()` | Counters + `UsageEvent` log |
| Future pricing | `src/lib/plans.ts` | Not shown in UI |
| Multi-country | `src/config/countries.ts`, `src/lib/brand.ts` | LV only enabled |
| PWA / mobile | `/public/manifest.json`, mobile card layouts | Active |

**Architecture docs:** [`/docs`](./docs)

Key documents:

- [Product strategy](./docs/PRODUCT_STRATEGY.md)
- [Monetization strategy](./docs/MONETIZATION_STRATEGY.md)
- [Founder program](./docs/FOUNDER_PROGRAM.md)
- [Feature system](./docs/FEATURE_SYSTEM.md)
- [Usage analytics](./docs/USAGE_ANALYTICS.md)
- [PWA mobile experience](./docs/PWA_MOBILE_EXPERIENCE.md)

---

## Roadmap (pēc MVP)

- [Railway deployment guide](./docs/DEPLOYMENT.md) — **receiptbox.online**
- Drošāka autentifikācija (Telegram Login Widget vai NextAuth)
- S3/R2 failu glabāšana
- PostgreSQL produkcijai
- Vairāku gadu salīdzinājumi un grafiki
- VID e-pakalpojumu integrācija
- Plānu un Premium funkciju ieslēgšana (infrastruktūra jau sagatavota — sk. `/docs`)
- ReceiptBox LT / EE (infrastruktūra sagatavota — sk. `/docs/MULTI_COUNTRY_STRATEGY.md`)

---

## Licence

MVP. Iekšējai izmantošanai / agrīnai testēšanai. Pievieno savu licenci pēc
nepieciešamības.
