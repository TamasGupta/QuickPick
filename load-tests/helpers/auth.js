// load-tests/helpers/auth.js
// Obtains a Supabase JWT for the test user by calling the Supabase Auth REST
// API directly — no browser, no cookies, just a Bearer token that can be
// attached to any API request that requires authentication.
//
// Usage:
//   import { getAuthHeaders } from "../helpers/auth.js";
//   export function setup() {
//     return { headers: getAuthHeaders() };
//   }
//   export default function (data) {
//     http.post(url, body, { headers: data.headers });
//   }
//
// k6 calls setup() ONCE before virtual users start. The returned token is
// shared across all VUs via the `data` argument to the default function.
// Supabase JWTs last 1 hour — enough for any reasonable load-test run.

import http from "k6/http";
import { check } from "k6";
import { SUPABASE_URL, ANON_KEY, TEST_EMAIL, TEST_PASSWORD } from "./env.js";

/**
 * Sign in with email+password and return request headers that include the
 * Supabase Bearer token. Call once from setup(), not per-iteration.
 *
 * @returns {{ Authorization: string, "Content-Type": string, apikey: string }}
 */
export function getAuthHeaders() {
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
      },
      tags: { name: "auth_login" },
    }
  );

  const ok = check(res, {
    "auth: status 200": (r) => r.status === 200,
    "auth: has access_token": (r) => {
      try { return !!JSON.parse(r.body).access_token; }
      catch { return false; }
    },
  });

  if (!ok) {
    console.error(`Auth failed (${res.status}): ${res.body}`);
    // Return empty headers — requests will 401 so tests will surface the error.
    return {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
    };
  }

  const { access_token } = JSON.parse(res.body);
  return {
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
}
