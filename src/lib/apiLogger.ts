import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { defaultRatelimit, authRatelimit, clientIp } from "@/lib/rateLimit";

// Wraps every API route handler so errors are logged consistently and
// nothing escapes as an unhandled 500 with no trace. Real server faults (5xx,
// unhandled exceptions) also go to Sentry; 4xx responses stay console-only
// since those are expected client errors (bad input, auth, etc.), not bugs.
//
// Also rate-limits by (route, client IP) via Upstash Redis — shared across
// serverless instances, unlike an in-memory counter. Pass `rateLimit: false`
// for routes that shouldn't be IP-throttled (e.g. the cron job, which is
// already gated by CRON_SECRET and isn't user-facing traffic).
//
// Deliberately never logs the request body: several routes here handle
// phone numbers, OTP codes, and passwords, and we don't want those ending
// up in logs. Only the route's own (already-sanitized) JSON error response
// is logged, plus the thrown error's message/stack for unhandled exceptions.
type RouteHandler<C = unknown> = (req: Request, ctx: C) => Promise<Response> | Response;

interface Options {
  rateLimit?: boolean | "auth";
}

export function withApiLogging<C = unknown>(
  routeName: string,
  handler: RouteHandler<C>,
  { rateLimit = true }: Options = {}
): RouteHandler<C> {
  return async (req, ctx) => {
    const start = Date.now();
    if (rateLimit) {
      // Fail OPEN, not closed: if Upstash is transiently unreachable, every
      // API route should keep working, not 500 out entirely. Only an
      // explicit "too many requests" result actually blocks the request.
      try {
        const limiter = rateLimit === "auth" ? authRatelimit : defaultRatelimit;
        const { success, reset } = await limiter.limit(`${routeName}:${clientIp(req)}`);
        if (!success) {
          return NextResponse.json(
            { error: "Too many requests. Please try again shortly." },
            { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) } }
          );
        }
      } catch (err) {
        console.error(`[api] ${req.method} ${routeName} -> rate limiter unavailable`, (err as Error).message);
      }
    }
    try {
      const res = await handler(req, ctx);
      if (res.status >= 400) {
        let body: unknown;
        try {
          body = await res.clone().json();
        } catch {
          // Non-JSON error response — fine, just log without a body.
        }
        console.error(
          `[api] ${req.method} ${routeName} -> ${res.status} (${Date.now() - start}ms)`,
          body ? JSON.stringify(body) : ""
        );
        if (res.status >= 500) {
          Sentry.captureMessage(`${req.method} ${routeName} -> ${res.status}`, {
            level: "error",
            tags: { route: routeName, method: req.method, status: String(res.status) },
          });
        }
      }
      return res;
    } catch (err) {
      // Next.js uses thrown errors as internal control-flow signals for
      // redirect(), notFound(), and dynamic-route detection (cookies()/
      // request.url force a route to be dynamic by throwing internally
      // during build-time analysis). These carry a `.digest` starting with
      // NEXT_REDIRECT / NEXT_NOT_FOUND / DYNAMIC_SERVER_USAGE and MUST be
      // rethrown untouched, or Next.js's own machinery breaks.
      const digest = (err as { digest?: string })?.digest;
      if (
        typeof digest === "string" &&
        (digest.startsWith("NEXT_REDIRECT") ||
          digest.startsWith("NEXT_NOT_FOUND") ||
          digest.startsWith("DYNAMIC_SERVER_USAGE"))
      ) {
        throw err;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[api] ${req.method} ${routeName} -> unhandled exception (${Date.now() - start}ms)`,
        error.message,
        error.stack
      );
      Sentry.captureException(error, {
        tags: { route: routeName, method: req.method },
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
