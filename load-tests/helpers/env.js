// load-tests/helpers/env.js
// Central place for all environment variables used by k6 load test scenarios.
// Values can be overridden at run-time via k6 --env flags:
//   k6 run --env BASE_URL=https://staging.example.com scenarios/01_public_browse.js

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
export const SUPABASE_URL =
  __ENV.SUPABASE_URL || "https://kmtuwdkspsiribplmmkj.supabase.co";
export const ANON_KEY =
  __ENV.ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdHV3ZGtzcHNpcmlicGxtbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDEyNDYsImV4cCI6MjA5OTI3NzI0Nn0.KLAuU-6FbOdnB8TxAnpDaGGd21bUK4w7dTmZcQNddGM";

// ── Test user (must exist in Supabase with role = 'buyer') ──────────────────
// Create via: Supabase Dashboard → Auth → Users → Invite user
export const TEST_EMAIL = __ENV.TEST_EMAIL || "loadtest@quickpick.com";
export const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadTest@1234";

// ── Seed data (fill in real UUIDs from your project) ───────────────────────
// A seller whose store has products and an approved status.
export const SELLER_ID =
  __ENV.SELLER_ID || "3c11fabf-6a68-4988-9eca-eb5524ea5f88";

// A product that belongs to SELLER_ID, with stock > 0 and is_active = true.
export const PRODUCT_ID =
  __ENV.PRODUCT_ID || "11da5b3a-e11a-49c8-a4b7-551308286faf";

// A saved address that belongs to the TEST_EMAIL user, within delivery radius.
export const ADDRESS_ID =
  __ENV.ADDRESS_ID || "4395dbf8-3c21-487e-b32f-1021ac5a5af6";

// A product name (used only in the order payload — re-priced server-side anyway).
export const PRODUCT_NAME = __ENV.PRODUCT_NAME || "Test Product";
export const PRODUCT_PRICE = __ENV.PRODUCT_PRICE || "50";
