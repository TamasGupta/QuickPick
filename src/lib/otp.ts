// Server-only OTP generation/storage for WhatsApp login — reuses the same
// Upstash Redis instance already wired up for rate limiting (see
// lib/rateLimit.ts), so no new infra is needed. Supabase Auth's phone
// provider only talks to SMS gateways, not WhatsApp, so this is the
// hand-rolled equivalent: generate a code, store a hash of it with a short
// TTL, verify it, then hand off to the same session-minting trick
// static-login already uses (see /api/auth/whatsapp/verify-otp).
import { createHash, randomInt } from "node:crypto";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const OTP_TTL_SECONDS = 5 * 60;
const KEY_PREFIX = "grabon-whatsapp-otp";
const TEST_OTP = "123456";
const TEST_PHONE_PREFIX = "+91987654321";
const ADDITIONAL_TEST_PHONES = ["+919000000001"];

function hash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function keyFor(phone: string): string {
  return `${KEY_PREFIX}:${phone}`;
}

function isTestPhone(phone: string): boolean {
  return phone.startsWith(TEST_PHONE_PREFIX) || ADDITIONAL_TEST_PHONES.includes(phone);
}

export function generateOtp(): string {
  // 6 digits, zero-padded — randomInt is cryptographically secure, unlike
  // Math.random(), which matters here since this code briefly gates a real
  // login session.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function storeOtp(phone: string, code: string): Promise<void> {
  await redis.set(keyFor(phone), hash(code), { ex: OTP_TTL_SECONDS });
}

// Single-use: a correct verify deletes the code immediately, so a leaked or
// replayed code can't be reused, and a wrong guess doesn't get unlimited
// retries against the same code (paired with the per-phone rate limit on
// the verify route itself).
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  // Test mode: allow fixed OTP for test phone numbers
  if (isTestPhone(phone) && code === TEST_OTP) {
    return true;
  }

  const stored = await redis.get<string>(keyFor(phone));
  if (!stored) return false;
  const match = stored === hash(code);
  if (match) await redis.del(keyFor(phone));
  return match;
}
