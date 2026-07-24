// load-tests/scenarios/03_seller_dashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Seller dashboard live-stat polling
//
// The seller dashboard auto-refreshes order counts and revenue every few
// seconds. This simulates 5 concurrent sellers keeping their dashboards open.
//
// Run:  k6 run load-tests/scenarios/03_seller_dashboard.js
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep } from "k6";
import { defaultOptions } from "../k6.config.js";
import { getAuthHeaders } from "../helpers/auth.js";
import { BASE_URL, SELLER_ID, SUPABASE_URL, ANON_KEY } from "../helpers/env.js";

export const options = {
  ...defaultOptions,
  stages: [
    { duration: "10s", target: 5 },   // Ramp to 5 sellers
    { duration: "2m",  target: 5 },   // Hold — sustained polling load
    { duration: "10s", target: 0 },   // Ramp down
  ],
};

export function setup() {
  console.log("🔐 Obtaining seller auth token...");
  const headers = getAuthHeaders();
  return { headers };
}

export default function (data) {
  const { headers } = data;

  // ── Seller orders query (mirrors SellerStatsLive component polling) ────────
  // The real component uses Supabase Realtime, but also falls back to REST.
  // We hit the REST endpoint here since k6 doesn't support WebSockets without
  // an extension.
  const ordersRes = http.get(
    // Supabase REST: GET orders where seller_id = :id, excluding pending payment
    `${SUPABASE_URL}/rest/v1/orders?seller_id=eq.${SELLER_ID}&payment_status=neq.pending&select=total,status`,
    {
      headers: {
        ...headers,
        apikey: ANON_KEY,
      },
      tags: { name: "seller_orders_poll" },
    }
  );

  check(ordersRes, {
    "seller_orders: status 200":    (r) => r.status === 200,
    "seller_orders: is array":       (r) => {
      try { return Array.isArray(JSON.parse(r.body)); }
      catch { return false; }
    },
  });

  // ── Seller product count (mirrors dashboard product count stat) ─────────
  const productsCountRes = http.get(
    `${SUPABASE_URL}/rest/v1/products?seller_id=eq.${SELLER_ID}&select=id`,
    {
      headers: {
        ...headers,
        apikey: ANON_KEY,
        Prefer: "count=exact",
        Range: "0-0",
      },
      tags: { name: "seller_products_count" },
    }
  );

  check(productsCountRes, {
    "seller_products: status 200 or 206": (r) =>
      r.status === 200 || r.status === 206,
  });

  // The real component polls every 8s — simulate compressed polling here
  sleep(4);
}
