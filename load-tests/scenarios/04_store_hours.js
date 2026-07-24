// load-tests/scenarios/04_store_hours.js
// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Store hours endpoint spike test
//
// GET /api/sellers/:id/hours is called on EVERY checkout page load — it's the
// new hottest read path. This test verifies it stays fast under a sudden spike
// of concurrent buyers hitting checkout simultaneously (e.g. flash sale).
//
// The endpoint calls is_store_open() RPC + two Supabase REST queries in
// parallel — this test confirms Postgres + Next.js can handle the concurrency.
//
// Run:  k6 run load-tests/scenarios/04_store_hours.js
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep } from "k6";
import { defaultOptions } from "../k6.config.js";
import { BASE_URL, SELLER_ID } from "../helpers/env.js";

export const options = {
  ...defaultOptions,
  stages: [
    { duration: "10s", target: 50  },  // Fast ramp — flash sale scenario
    { duration: "30s", target: 200 },  // Spike to 200 VUs
    { duration: "30s", target: 200 },  // Hold the spike
    { duration: "20s", target: 0   },  // Ramp down
  ],
  thresholds: {
    ...defaultOptions.thresholds,
    // The hours endpoint should still respond within 1s at 200 VUs
    "http_req_duration{name:store_hours_spike}": ["p(95)<1000"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/sellers/${SELLER_ID}/hours`, {
    tags: { name: "store_hours_spike" },
  });

  check(res, {
    "hours: status 200 or 404": (r) => r.status === 200 || r.status === 404,
    "hours: fast response":      (r) => r.timings.duration < 1000,
    "hours: valid JSON":         (r) => {
      try { JSON.parse(r.body); return true; }
      catch { return r.status === 404; }
    },
    "hours: has is_open":        (r) => {
      if (r.status !== 200) return true; // 404 is fine
      try { return typeof JSON.parse(r.body).is_open === "boolean"; }
      catch { return false; }
    },
  });

  // No sleep — we want maximum throughput to stress the endpoint
  sleep(0.1);
}
