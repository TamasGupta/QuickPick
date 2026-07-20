# GrabOn — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2026-07-10
**Owner:** naitik@techind.co
**Status:** Draft → In Implementation (MVP)

---

## 1. Overview

**GrabOn** is a multi-seller **quick-commerce** platform (think Blinkit / Zepto / Instacart) that lets local sellers list their catalog in bulk by uploading a **CSV, Excel, or PDF** file, and lets buyers browse, order, and receive groceries & daily essentials fast.

We ship **PWA-first** (installable, offline-capable web app) so we can iterate quickly across desktop + mobile browsers with a single codebase, then wrap/native-port to iOS/Android based on user response. The architecture is chosen so the same backend/API powers the future mobile apps with zero rework.

### 1.1 Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Sellers can bulk-list products from a file in < 2 min | ≥ 90% of uploaded rows import cleanly |
| G2 | Buyers can place an order in < 90 seconds | Checkout completion rate ≥ 60% |
| G3 | Handle **1,000+ concurrent users** at launch with room to 10× | p95 API latency < 400 ms |
| G4 | Single codebase serving PWA today, mobile tomorrow | Same REST/RPC API reused by mobile |

### 1.2 Non-Goals (v1)

- Own delivery-fleet routing/logistics optimization (manual/assigned rider status only in v1).
- In-app chat / customer support ticketing.
- Multi-currency / multi-country (India / INR only in v1).
- Advanced recommendations / personalization ML.

---

## 2. Target Users & Roles

| Role | Description | Key Needs |
|------|-------------|-----------|
| **Buyer** | End customer ordering essentials | Fast browse, search, cart, quick checkout, live order status |
| **Seller** | Local store / dark-store owner | Easy bulk catalog upload, inventory & order management, payouts view |
| **Admin** | Platform operator | Approve sellers, manage categories, oversight, moderation |
| **Rider** (light, v1) | Delivery person | See assigned orders, update delivery status |

---

## 3. Core Features

### 3.1 Buyer (Consumer PWA)
1. **Auth** — phone OTP / email magic-link (Supabase Auth).
2. **Home / Catalog** — category tiles, featured, banners.
3. **Search & Filter** — full-text search, category + price filters.
4. **Product Detail** — images, price, MRP/discount, stock, seller, add-to-cart.
5. **Cart** — quantity edit, running total, delivery fee, min-order rules.
6. **Checkout** — saved addresses, delivery slot, order summary.
7. **Payments** — Razorpay (UPI, cards, wallets, netbanking) + Cash on Delivery.
8. **Order Tracking** — status timeline (Placed → Accepted → Packed → Out for Delivery → Delivered).
9. **Order History & Reorder**.
10. **Profile & Addresses**.

### 3.2 Seller (Merchant Portal)
1. **Seller Onboarding** — store details, submit for admin approval.
2. **Bulk Product Upload** — **CSV / Excel / PDF** → parsed → preview → confirm import. *(Flagship feature.)*
   - Column auto-mapping + validation, per-row error reporting.
   - Downloadable template.
3. **Product Management** — edit price/stock, activate/deactivate, single-add.
4. **Inventory** — stock levels, low-stock alerts.
5. **Order Management** — incoming orders, accept/reject, mark packed/handed-over.
6. **Dashboard** — sales, orders, top products, revenue.

### 3.3 Admin
1. Approve / suspend sellers.
2. Manage global category taxonomy.
3. Platform overview (GMV, orders, active users).
4. Moderate products.

---

## 4. The Bulk Upload Pipeline (Flagship)

```
Upload file ──► Detect type ──► Parse ──► Normalize+Validate ──► Preview (edit)  ──► Import ──► Products live
 (CSV/XLSX/PDF)               (per-type)   (schema map, errors)   (seller confirms)  (bulk insert w/ RLS)
```

- **CSV** → `papaparse` (streamed, handles large files).
- **Excel (.xlsx/.xls)** → `xlsx` (SheetJS) → JSON rows.
- **PDF** → `pdf-parse` text extraction → heuristic table/line parsing into rows. PDFs are messy, so PDF import always routes through the **preview-and-edit** step; unparseable rows are flagged, never silently dropped.
- **Canonical product schema** columns: `name, description, category, price, mrp, unit, stock, sku, image_url, brand`.
- **Validation**: required fields, numeric coercion for price/stock, dedupe by SKU, per-row error messages.
- Files stored in Supabase Storage; import runs server-side; large imports batched (500 rows/insert).

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **Next.js 14 (App Router) + TypeScript + Tailwind** | SSR/ISR, one codebase, great PWA support |
| PWA | `next-pwa` (service worker, offline shell, installable, manifest) | Installable + offline browse |
| Backend/API | Next.js Route Handlers + **Supabase** (Postgres, Auth, Storage, Realtime) | Managed, scalable, RLS security, realtime order updates |
| DB | **Postgres** (via Supabase) with **Row-Level Security** | Relational integrity for inventory/orders; RLS = per-role data isolation |
| Auth | Supabase Auth (OTP / magic link) | Built-in, JWT, integrates with RLS |
| Payments | **Razorpay** (INR — UPI/cards/wallets) + COD | India-standard |
| State | Zustand (cart) + React Query pattern via server components | Lightweight |
| File parse | `papaparse`, `xlsx`, `pdf-parse` | Cover CSV/Excel/PDF |
| Hosting | Vercel (frontend) + Supabase (data) | Autoscaling, edge, zero-ops |

### 5.2 Why this scales to 1,000+ users (and beyond)
- **Stateless Next.js** on Vercel → horizontal autoscale; no sticky sessions.
- **Supabase Postgres** with connection pooling (PgBouncer) + indexed queries; read-heavy catalog cached via ISR/CDN.
- **CDN-served** static catalog pages & images.
- **Realtime** order status via Supabase channels (no polling storms).
- **RLS** pushes authorization into the DB — safe multi-tenant by default.
- Clear path to 10×: add Redis cache, read replicas, background job queue.

### 5.3 Same API → future mobile
All data access goes through Supabase client/REST + a thin set of Next.js API routes. A React Native / Expo app reuses the identical Supabase endpoints and auth — no backend rewrite.

---

## 6. Data Model (high level)

- **profiles** (id → auth.users, role: buyer|seller|admin|rider, name, phone)
- **sellers** (id, owner_id, store_name, status: pending|approved|suspended, address, ...)
- **categories** (id, name, slug, icon)
- **products** (id, seller_id, name, description, category_id, price, mrp, unit, stock, sku, image_url, brand, is_active)
- **addresses** (id, user_id, label, line1, line2, city, pincode, lat, lng)
- **carts / cart_items** (or client-side cart persisted at checkout)
- **orders** (id, buyer_id, seller_id, status, subtotal, delivery_fee, total, payment_status, payment_id, address_id, slot)
- **order_items** (id, order_id, product_id, name, price, qty)
- **upload_jobs** (id, seller_id, file_url, type, status, total_rows, imported, errors jsonb)

Full DDL with indexes & RLS policies in `supabase/schema.sql`.

---

## 7. Order & Payment Flow

1. Buyer builds cart → checkout.
2. Client calls `POST /api/orders` → creates `orders` row (`payment_status=pending`).
3. For online pay: `POST /api/payment/create` → Razorpay order → client opens Razorpay checkout.
4. On success: `POST /api/payment/verify` verifies signature (HMAC) server-side → marks order `paid`, decrements stock atomically.
5. Seller sees order in realtime → accepts → packs → delivers; each transition updates status; buyer sees live timeline.
6. COD skips steps 3–4; stock decremented on seller acceptance.

---

## 8. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Performance | p95 API < 400 ms; catalog LCP < 2.5 s |
| Scale | 1,000 concurrent users at launch, architecture to 10× |
| Security | RLS on all tables; server-side payment verification; input validation; signed storage URLs |
| PWA | Installable, offline catalog shell, add-to-home-screen |
| Accessibility | Semantic HTML, keyboard nav, contrast AA |
| Observability | Structured logs, error boundary, Supabase logs |

---

## 9. MVP Scope (this build)

✅ Auth (buyer/seller) · ✅ Catalog + search + product detail · ✅ Cart + checkout · ✅ Razorpay + COD flow · ✅ Order placement + status · ✅ Seller portal with **CSV/Excel/PDF bulk upload → preview → import** · ✅ Seller product & order management · ✅ Basic admin (approve sellers) · ✅ PWA (manifest + service worker) · ✅ Postgres schema + RLS.

**Deferred (v2):** rider app depth, delivery routing, ratings/reviews, coupons/promos, push notifications, analytics dashboards, i18n.

---

## 10. Roadmap

| Phase | Scope |
|-------|-------|
| **P0 (now)** | This MVP — PWA end-to-end |
| **P1** | Ratings/reviews, coupons, push notifications, seller payouts |
| **P2** | React Native mobile apps (reuse API), delivery routing |
| **P3** | Recommendations, multi-city, analytics, scale hardening (Redis/replicas) |

---

## 11. Open Questions / Assumptions

- Assuming India / INR / Razorpay (confirmed).
- Single-seller-per-order in v1 (cart split across sellers → separate orders) — simplifies fulfillment.
- Delivery fee is flat/config in v1; dynamic pricing later.
- Rider role is minimal (status update) in v1.
