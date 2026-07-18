import { NextResponse } from "next/server";

// Wraps every API route handler so errors are logged consistently and
// nothing escapes as an unhandled 500 with no trace. On Vercel, console.error
// output shows up directly in the project's Runtime Logs — no extra logging
// service needed for a project this size.
//
// Deliberately never logs the request body: several routes here handle
// phone numbers, OTP codes, and passwords, and we don't want those ending
// up in logs. Only the route's own (already-sanitized) JSON error response
// is logged, plus the thrown error's message/stack for unhandled exceptions.
type RouteHandler<C = unknown> = (req: Request, ctx: C) => Promise<Response> | Response;

export function withApiLogging<C = unknown>(routeName: string, handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    const start = Date.now();
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
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
