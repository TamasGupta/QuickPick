# ⚡ GrabOn

A multi-seller **quick-commerce PWA** (like Blinkit / Zepto). Sellers bulk-list
their catalog by uploading a **CSV, Excel, or PDF**; buyers browse, order, pay
(Razorpay / COD), and track delivery in real time.

> See [PRD.md](./PRD.md) for the full product spec.

## Stack

- **Next.js 14** (App Router, TypeScript) + **Tailwind CSS**
- **Supabase** — Postgres, Auth, Realtime, Storage, Row-Level Security
- **Razorpay** — payments (UPI / cards / wallets) + Cash on Delivery
- **PWA** via `next-pwa` (installable, offline shell)
- Parsing: `papaparse` (CSV), `xlsx` (Excel), `pdf-parse` (PDF)

## Features

| Buyer | Seller | Admin |
|-------|--------|-------|
| Auth (password / magic link) | Store onboarding | Approve / suspend sellers |
| Catalog + full-text search | **Bulk CSV/Excel/PDF upload → preview → import** | Platform stats |
| Cart + checkout | Product & inventory management | |
| Razorpay + COD | Order management (accept→pack→deliver) | |
| Live order tracking | Sales dashboard | |

## Getting started

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

- Go to [supabase.com](https://supabase.com) → new project.
- Open **SQL Editor** → paste & run [`supabase/schema.sql`](./supabase/schema.sql).
  This creates all tables, indexes, RLS policies, triggers, and default categories.
- In **Authentication → Providers**, enable Email (and disable "Confirm email"
  for quick local testing, or use magic links).

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (Razorpay dashboard → API keys; use `rzp_test_...` for testing)

### 4. Seed demo data (optional but recommended)

```bash
npm run seed
```

Creates an **approved demo seller** (`demo-seller@quickpick.test` / `quickpick123`)
and imports `public/sample-products.csv` so the catalog isn't empty.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000

> Note: the PWA service worker is disabled in development. Run `npm run build && npm run start` to test installability/offline.

## Key flows to try

1. **Buyer:** browse → add to cart → checkout → pay (Razorpay test card `4111 1111 1111 1111`) or COD → watch the live tracking timeline.
2. **Seller:** `/seller` → create store → **Bulk Upload** → drop the sample CSV (or an Excel/PDF) → edit the preview → import → see products live.
3. **Admin:** set a profile's `role` to `admin` in Supabase, then visit `/admin` to approve sellers.

## Making yourself an admin

```sql
update profiles set role = 'admin' where id = '<your-auth-user-id>';
```

## Scaling notes (built for 1,000+ users, path to 10×)

- Stateless Next.js on Vercel → horizontal autoscale.
- Supabase Postgres with PgBouncer pooling + indexed queries; catalog served via CDN/ISR.
- RLS enforces multi-tenant isolation at the database layer.
- Realtime order updates instead of polling.
- Next: Redis cache, read replicas, background job queue for very large imports.

## Project structure

```
src/
  app/                 # App Router pages + API routes
    api/               # orders, payment (create/verify), upload (parse/import)
    seller/            # dashboard, upload, products, orders
    admin/             # seller approval console
  components/          # UI components (client + server)
  lib/
    supabase/          # browser + server + service clients
    parsers/           # CSV / Excel / PDF → normalized rows
    razorpay.ts        # payment SDK + signature verify
  store/cart.ts        # Zustand cart (persisted)
supabase/schema.sql    # full DB schema + RLS
scripts/seed.ts        # demo seed
```

## Roadmap (post-MVP)

Ratings/reviews · coupons · push notifications · seller payouts · **React Native
mobile apps (reuse this same Supabase API)** · delivery routing · analytics.
