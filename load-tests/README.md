# Load Tests — QuickPick (k6)

## Prerequisites

Install the k6 binary (one-time):

```powershell
# Windows
winget install k6 --source winget

# Verify
k6 version
```

## Setup

1. **Fill in your seed UUIDs** in `helpers/env.js` (or pass them as `--env` flags):
   - `SELLER_ID` — an approved seller in your Supabase project
   - `PRODUCT_ID` — an active product with `stock > 0` belonging to that seller
   - `ADDRESS_ID` — a saved address belonging to your test buyer user

2. **Create a test buyer account** in Supabase → Auth → Users, then update `TEST_EMAIL` / `TEST_PASSWORD` in `helpers/env.js`.

3. Make sure `npm run dev` is running (or set `BASE_URL` to your staging URL).

## Running Tests

```powershell
# Unauthenticated browse (safest to run first)
npm run load:browse

# Full checkout flow (WRITES real orders to DB — use local dev)
npm run load:checkout

# Seller dashboard polling
npm run load:seller

# Store hours spike (200 VUs)
npm run load:hours

# Rate-limit validation
npm run load:spike

# Browse + hours + spike (read-only suite)
npm run load:all
```

## Overriding config at run time

```powershell
k6 run --env BASE_URL=https://your-staging.vercel.app `
        --env SELLER_ID=<uuid> `
        --env PRODUCT_ID=<uuid> `
        --env ADDRESS_ID=<uuid> `
        --env TEST_EMAIL=loadtest@example.com `
        --env TEST_PASSWORD=YourPassword123 `
        load-tests/scenarios/02_checkout_flow.js
```

## Thresholds (pass/fail gates)

| Metric | Gate |
|--------|------|
| `http_req_duration p(95)` | < 800 ms |
| `http_req_duration p(99)` | < 2 000 ms |
| `http_req_failed` | < 1% (5% for checkout) |
| `http_req_duration{name:place_order} p(95)` | < 1 500 ms |
| `http_req_duration{name:store_hours_spike} p(95)` | < 1 000 ms |
| `rate_limit_hits count` | > 0 (spike test expects 429s) |

k6 exits with code **99** if any threshold is breached — plug this into CI with `if ($LASTEXITCODE -ne 0) { throw }`.

## Scenario summary

| File | What it tests | VUs | Auth |
|------|---------------|-----|------|
| `01_public_browse.js` | Product grid + store hours/location | 50 | ❌ |
| `02_checkout_flow.js` | Full COD order journey | 10 | ✅ |
| `03_seller_dashboard.js` | Seller stats polling | 5 | ✅ |
| `04_store_hours.js` | `/api/sellers/:id/hours` spike | 200 | ❌ |
| `05_spike.js` | Rate-limit 429 validation | 1 | ❌ |

## ⚠ Important notes

- **Scenario 02 writes real `orders` + `order_items` rows.** Run against `localhost:3000` or a staging project — never production.
- The `is_store_open()` gate will skip order creation if the store is currently closed. Either configure open hours for your test seller or run during open hours.
- Scenario 05 must be run against `localhost` — Vercel assigns different outbound IPs per invocation, so the shared-IP rate-limit bucket won't fill up as expected.
