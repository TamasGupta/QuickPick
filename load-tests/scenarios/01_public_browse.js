// load-tests/scenarios/01_public_browse.js
// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Unauthenticated buyer browse
// Simulates the highest-traffic path — users scrolling the product grid and
// the checkout page fetching store location + hours. No auth required.
//
// Run:  k6 run load-tests/scenarios/01_public_browse.js
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep } from "k6";
import { defaultOptions } from "../k6.config.js";
import { BASE_URL, SELLER_ID } from "../helpers/env.js";

export const options = {
  ...defaultOptions,
  stages: [
    { duration: "30s", target: 20 },   // Ramp up to 20 VUs
    { duration: "2m",  target: 50 },   // Hold at 50 VUs (peak browse traffic)
    { duration: "30s", target: 0  },   // Ramp down
  ],
};

export default function () {
  // ── 1. Product grid — first page (no cursor = first page) ─────────────────
  const productsRes = http.get(`${BASE_URL}/api/products`, {
    tags: { name: "products_page1" },
  });
  check(productsRes, {
    "products: status 200":      (r) => r.status === 200,
    "products: has products key": (r) => {
      try { return Array.isArray(JSON.parse(r.body).products); }
      catch { return false; }
    },
  });

  sleep(1); // Think time — user reads products

  // ── 2. Product grid — category filter (simulates category page) ───────────
  const catRes = http.get(`${BASE_URL}/api/products?cat=snacks`, {
    tags: { name: "products_category" },
  });
  check(catRes, {
    "products_cat: status 200": (r) => r.status === 200,
  });

  sleep(0.5);

  // ── 3. Store location fetch (checkout page initial load) ──────────────────
  const locationRes = http.get(`${BASE_URL}/api/sellers/${SELLER_ID}/location`, {
    tags: { name: "store_location" },
  });
  check(locationRes, {
    "location: status 200 or 404": (r) => r.status === 200 || r.status === 404,
  });

  // ── 4. Store hours fetch (checkout page — runs in parallel with location) ─
  const hoursRes = http.get(`${BASE_URL}/api/sellers/${SELLER_ID}/hours`, {
    tags: { name: "store_hours" },
  });
  check(hoursRes, {
    "hours: status 200 or 404":  (r) => r.status === 200 || r.status === 404,
    "hours: has is_open field":  (r) => {
      try { return typeof JSON.parse(r.body).is_open === "boolean"; }
      catch { return true; } // 404 → store not found, not a test failure
    },
  });

  sleep(2); // Think time before next iteration
}
