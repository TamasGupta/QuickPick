// load-tests/scenarios/02_checkout_flow.js
// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Full authenticated buyer checkout (COD)
//
// Flow per VU iteration:
//   1. GET  /api/sellers/:id/hours       — store open/closed check
//   2. GET  /api/sellers/:id/location    — client-side radius warning
//   3. GET  /api/products                — fetch products to fill cart
//   4. POST /api/orders                  — place COD order (writes DB)
//   5. GET  /api/orders/:id/live         — poll order status (×3, 2s apart)
//
// ⚠ This scenario writes real rows to your Supabase project.
//   Point BASE_URL at http://localhost:3000 (local dev) unless you have
//   a dedicated staging project. Set TEST_EMAIL / TEST_PASSWORD / SELLER_ID /
//   PRODUCT_ID / ADDRESS_ID in your environment before running.
//
// Run:
//   k6 run load-tests/scenarios/02_checkout_flow.js
//   k6 run --env SELLER_ID=<uuid> --env PRODUCT_ID=<uuid> --env ADDRESS_ID=<uuid> \
//           load-tests/scenarios/02_checkout_flow.js
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep } from "k6";
import { defaultOptions } from "../k6.config.js";
import { getAuthHeaders } from "../helpers/auth.js";
import {
  BASE_URL,
  SELLER_ID,
  PRODUCT_ID,
  ADDRESS_ID,
  PRODUCT_NAME,
  PRODUCT_PRICE,
} from "../helpers/env.js";

export const options = {
  ...defaultOptions,
  stages: [
    { duration: "20s", target: 5  },  // Warm up
    { duration: "2m",  target: 10 },  // Hold at 10 concurrent checkouts
    { duration: "20s", target: 0  },  // Cool down
  ],
  // Relax the global error threshold for this scenario — we accept that
  // the store-hours gate or out-of-stock will return 400 for some VUs when
  // running against real data. Tune this for your setup.
  thresholds: {
    ...defaultOptions.thresholds,
    http_req_failed: ["rate<0.05"], // allow up to 5% errors (expected 400s)
    "http_req_duration{name:place_order}": ["p(95)<1500"],
  },
};

// setup() runs ONCE before any VU starts. Obtain the JWT here and pass it to
// every VU via the returned object. This avoids hammering the auth endpoint.
export function setup() {
  console.log("🔐 Obtaining auth token for test user...");
  const headers = getAuthHeaders();
  console.log("✅ Auth token obtained.");
  return { headers };
}

export default function (data) {
  const { headers } = data;

  // ── Step 1: Fetch store hours (mirrors checkout page useEffect) ───────────
  const hoursRes = http.get(`${BASE_URL}/api/sellers/${SELLER_ID}/hours`, {
    tags: { name: "store_hours" },
  });
  const hoursOk = check(hoursRes, {
    "hours: status 200":    (r) => r.status === 200,
    "hours: has is_open":   (r) => {
      try { return typeof JSON.parse(r.body).is_open === "boolean"; }
      catch { return false; }
    },
  });

  // If the store is closed right now, skip placing the order (mirrors real UI).
  let storeIsOpen = true;
  if (hoursOk && hoursRes.status === 200) {
    try {
      storeIsOpen = JSON.parse(hoursRes.body).is_open;
    } catch { /* ignore */ }
  }

  // ── Step 2: Fetch store location (parallel in real UI — sequential here) ──
  const locationRes = http.get(`${BASE_URL}/api/sellers/${SELLER_ID}/location`, {
    tags: { name: "store_location" },
  });
  check(locationRes, {
    "location: status 200 or 404": (r) => r.status === 200 || r.status === 404,
  });

  sleep(0.5); // Simulate user reading the checkout page

  // ── Step 3: Fetch products (simulates cart re-validation on checkout load) ─
  const productsRes = http.get(`${BASE_URL}/api/products`, {
    tags: { name: "products_checkout" },
  });
  check(productsRes, {
    "products: status 200": (r) => r.status === 200,
  });

  sleep(1); // User reviews cart

  // ── Step 4: Place order ────────────────────────────────────────────────────
  if (!storeIsOpen) {
    console.log(`VU ${__VU}: Skipping order — store is closed.`);
    sleep(2);
    return;
  }

  const orderPayload = JSON.stringify({
    seller_id:       SELLER_ID,
    address_id:      ADDRESS_ID,
    delivery_slot:   "Now (10–20 min)",
    payment_method:  "cod",
    items: [
      {
        product_id: PRODUCT_ID,
        name:       PRODUCT_NAME,
        price:      parseFloat(PRODUCT_PRICE),
        qty:        1,
      },
    ],
  });

  const orderRes = http.post(`${BASE_URL}/api/orders`, orderPayload, {
    headers,
    tags: { name: "place_order" },
  });

  const orderOk = check(orderRes, {
    "order: status 200":     (r) => r.status === 200,
    "order: has id":         (r) => {
      try { return !!JSON.parse(r.body).id; }
      catch { return false; }
    },
  });

  if (!orderOk) {
    const body = orderRes.body || "(empty)";
    console.warn(
      `VU ${__VU}: Order failed (${orderRes.status}): ${body.slice(0, 200)}`
    );
    sleep(2);
    return;
  }

  const orderId = JSON.parse(orderRes.body).id;
  console.log(`VU ${__VU}: Order placed — ${orderId}`);

  sleep(1); // Simulate redirect to order detail page

  // ── Step 5: Poll order live status (mirrors /orders/:id page polling) ─────
  for (let poll = 0; poll < 3; poll++) {
    const liveRes = http.get(`${BASE_URL}/api/orders/${orderId}/live`, {
      headers,
      tags: { name: "order_live_poll" },
    });
    check(liveRes, {
      "live: status 200":      (r) => r.status === 200,
      "live: has status field": (r) => {
        try { return !!JSON.parse(r.body).status; }
        catch { return false; }
      },
    });
    sleep(2); // Real UI polls every 8s — compressed for load test efficiency
  }

  sleep(1);
}
