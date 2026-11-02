# Palawi — Inventory & Operations Tracker (मराठी / English)

Digitises the paper registers of **Prabha-Hira Pratishthan, Pandharpur** (बालगृह run by **Palawi — "a touch of life"**)
and tracks inventory end to end. Multi-tenant: an admin can add further clients, each with its own institutions;
one client's data is never visible to another.

## What it does

| Area | Store User | Admin |
|---|---|---|
| **Registers** — grain & provisions, meals, vegetables, fruit, monthly personal items, cleaning supplies, utensils/bedding/stationery, expenses, stock in (purchase / donation / opening) | Enter, edit or delete own entries while pending | View all, approve / reject (reason) / unlock (reason), approve a whole day, record medical officer verification, stock adjustments |
| **Stock** — balances (approved only, pending shown separately), item ledger, days of stock left, low/out alerts (red), monthly statement + Excel | View | View, item master (add / edit / deactivate) |
| **Gate register** — visits by date, visitor profiles (de-duplicated by mobile + name), donation visits create a Donation and a pending stock-in entry | Record visits; mobiles masked, DOB hidden | Full view, approve / reject |
| **Donations** — list, bilingual **PDF receipt** (only after approval, numbered `PALAWI/2026-27/0001`) | View | View |
| **Excel import** — upload → dry-run review (flags, note rows) → import → rollback | — | Yes |
| **Dashboard** — KPIs, today's tasks, low stock, clickable register cards | Reduced | + charts (each with table view and CSV), recent activity |
| **Print / Excel** — every register prints in a paper-book layout; the "अधिक्षकाची सही" column becomes "Approved by … on …" | Yes | Yes |

No child records are kept (client decision): the daily child count is a number on each entry, and personal items are recorded by item and quantity.

## Quick start

Requires Node 24+ and a MongoDB replica set (MongoDB Atlas works; Prisma needs a replica set for transactions).

```bash
npm install
cp .env.example .env      # set MONGODB_URI / DATABASE_URL and SESSION_SECRET
npm run db:push           # creates collections and indexes
npm run db:seed           # Palawi + Prabha-Hira Pratishthan + 2 users + 90-item master
npm run build && npm start
```

Seed logins (change the passwords in **Settings** after first login):

| Role | Login (phone or email) | Password |
|---|---|---|
| Admin (can also add clients) | `9000000001` / `admin@palawi.org` | `ChangeMe@123` |
| Store User | `9000000002` / `store@palawi.org` | `ChangeMe@123` |

To load the gate register, sign in as admin → **Excel import** → upload `Gate Register 1jan26 to 30 Sep26.xlsx` → review → **Import records**.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests + MongoDB tenant-isolation tests (throwaway `<db>-test` database, dropped afterwards) |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm run db:push` | Sync Prisma schema (collections, indexes) to MongoDB |
| `npm run db:seed` | Idempotent seed |
| `node scripts/demo-data.mts` | Adds sample records (15+ per register, gate visits, donations) marked "DEMO SAMPLE", for training and demos; `--remove` deletes exactly those again |
| `npm run palette` / `icons` | Re-extract colour tokens / PWA icons from `public/palawi-logo.png` |

## Deploying on Vercel

`vercel.json` pins the server functions to **Mumbai (`bom1`)**, next to the MongoDB Atlas cluster (AWS `ap-south-1`).
Vercel's default region is Washington DC, which adds ~200 ms to every database call. If the database moves to
another region, change `regions` to match. Set `DATABASE_URL`, `MONGODB_URI`, `MONGODB_DB` and `SESSION_SECRET` in the
Vercel project's environment variables.

## Architecture

- **Next.js 15 (App Router) + TypeScript**, server components and server actions (forms also work without JavaScript); Tailwind CSS 3.4.
- **MongoDB + Prisma 6.** Every tenant document has `clientId` (and `institutionId` for branch data).
  `tenantDb(clientId)` (`src/lib/tenant.ts`) forces `clientId` into every query, stamps it on every create, rejects
  cross-tenant writes and hides soft-deleted rows (`deletedAt: { isSet: false }` — on MongoDB unset fields are missing, not null).
- **One generic register engine** (`src/lib/modules.ts` config + `src/lib/entries.ts`): each paper register is a config
  (categories, line mode, header fields). All stock-moving registers post to one **stock ledger** (`stock_movements`);
  balance = sum of **approved** movements, never an editable number. Ledger maths: `src/lib/stock.ts` (unit tested).
- **Approval workflow**: entries start Pending; admin approves (stock check against approved stock; a reason is required to
  approve into negative stock), rejects with reason, unlocks with reason, or approves a whole day. Approved entries are locked.
  Everything is written to the audit log.
- **Gate import** (`src/lib/gate.ts`, `src/lib/gate-import.ts`): canonical purposes ("school/Collage Visit" → School/college),
  DOB placeholders and corrupt dates flagged (a header dated year 26184 is inferred as the next day), mobiles normalised,
  visitors de-duplicated; a failed import cleans up after itself.
- **i18n**: `next-intl`, `messages/mr.json` + `messages/en.json` (Marathi default), DD/MM/YYYY, ₹ Indian grouping, optional Marathi numerals.
- **Receipts**: pdfkit with Noto Sans + Noto Sans Devanagari (proper conjunct shaping), Marathi and English on one receipt.

## Design tokens (extracted from the logo)

`scripts/extract-palette.mjs` samples the logo and writes `src/styles/tokens.json` / `tokens.css`: teal `#60b191`,
leaf `#cde494`, skin accent `#e6ad9a`; buttons use `primary-600/700` (AA contrast with white). Red is used only for alerts.
Charts use two logo-hue colours with raised chroma (`#1b7a57`, `#9cc22e`), validated for colour-blind separation; any chart
with more categories uses single-colour bars, and every chart has a table view and CSV export.

## Still to confirm with Palawi

- Marathi tagline ("जीवनाचा स्पर्श"). The name is spelled "पालवी" (confirmed).
- The item list (seeded as editable defaults) and reorder levels.
- 80G details on donation receipts.
- Legal retention period for records.
- A higher-resolution logo (the PNG is 185×70).

Not built yet: OTP login, offline drafts with sync (PWA is installable but online-only), bill photo upload on expenses,
automated backups (use Atlas backups), recipe-based auto-deduction from meals.

## Notes for this development machine

Windows Application Control blocks several downloaded native binaries (git, esbuild, Next's SWC binary, Tailwind 4,
`@parcel/watcher`), so: Next uses its WASM compiler (`next start` can take ~3.5 minutes to become ready here), Tailwind 3.4,
`next-intl` pinned to 4.4.0, and tests run on Node's built-in runner.
