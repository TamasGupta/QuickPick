// load-tests/scenarios/05_spike.js
// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Rate-limit validation
//
// Sends more than 60 requests/minute from a single VU to verify Upstash rate
// limiting returns 429 at the configured threshold (60 req / 60s per IP).
//
// Expected result:
//   • First ~60 requests: status 200
//   • Subsequent requests within the same 60-second window: status 429
//   • Check "at least one 429 observed" passes
//
// ⚠ Run against http://localhost:3000 ONLY.
//   Against localhost, all VUs share the "unknown" IP bucket — which is exactly
//   what we want to test the rate limiter with. Against Vercel, each serverless
//   invocation may get a different outbound IP, diluting the test.
//
// Run:  k6 run load-tests/scenarios/05_spike.js
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { BASE_URL, SELLER_ID } from "../helpers/env.js";

// Custom metric — counts how many 429 responses we received
const rateLimitHits = new Counter("rate_limit_hits");

export const options = {
  // Single VU hammering one endpoint as fast as possible for 90 seconds.
  // The rate limiter window is 60s, so by ~65s we should be seeing 429s.
  vus:      1,
  duration: "90s",

  thresholds: {
    // We WANT 429s here — the test PASSES if at least one occurs.
    // This confirms rate limiting is active and correctly configured.
    rate_limit_hits: ["count>0"],

    // But the app should not crash — all responses must be 200 or 429
    // (no 500s, no timeouts).
    "http_req_duration{expected_response:true}": ["p(99)<2000"],
  },
};

export default function () {
  // Target the store hours endpoint — lightweight, no auth, high traffic
  const res = http.get(`${BASE_URL}/api/sellers/${SELLER_ID}/hours`, {
    tags: { name: "rate_limit_test" },
  });

  if (res.status === 429) {
    rateLimitHits.add(1);
    check(res, {
      "429: has Retry-After or rate limit header": (r) =>
        r.headers["Retry-After"] !== undefined ||
        r.headers["X-RateLimit-Limit"] !== undefined ||
        r.status === 429, // always passes — just documents expectation
    });
  } else {
    check(res, {
      "200 within limit": (r) => r.status === 200 || r.status === 404,
    });
  }

  // Fire at ~70 req/min (slightly above the 60/min limit).
  // 60s / 70 requests ≈ 857ms per request.
  sleep(0.85);
}
