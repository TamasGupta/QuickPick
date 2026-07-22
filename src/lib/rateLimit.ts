import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Shared Upstash-backed limiter — one instance reused by every API route via
// withApiLogging (see apiLogger.ts), so buckets persist across serverless
// invocations/instances instead of resetting on every cold start the way an
// in-memory counter would.
const redis = Redis.fromEnv();

// General default: generous enough for normal polling (the busiest client
// components poll every 8s, i.e. ~7-8 req/min), but low enough to blunt a
// script hammering an endpoint.
export const defaultRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  analytics: true,
  prefix: "grabon-rl",
});

// Stricter limiter for auth endpoints — these are the highest-value target
// for abuse (brute-forcing the shared static OTP code, or SMS-bombing a
// phone number once real OTP delivery is on).
export const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "grabon-rl-auth",
});

export function clientIp(req: Request): string {
  // Vercel sets x-forwarded-for; the first entry is the original client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
