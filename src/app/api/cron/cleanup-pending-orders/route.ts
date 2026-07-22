import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

// How long a payment_status='pending' order is given before it's considered
// abandoned. Razorpay's own checkout session times out well before this
// (its countdown is ~15-20 min), so 30 min comfortably avoids cancelling
// anything still genuinely mid-payment.
const STALE_MINUTES = 30;

// GET /api/cron/cleanup-pending-orders — sweeps up orders whose buyer never
// completed (or explicitly failed) an online payment, closing the gap the
// client-side Razorpay `ondismiss`/`payment.failed` handlers can't cover:
// the buyer closing the browser tab entirely mid-checkout, rather than using
// Razorpay's own exit control. See /api/orders and checkout/page.tsx for the
// client-side half of this (which handles the common case immediately,
// without waiting on this sweep).
//
// Triggered by Vercel Cron (see vercel.json) on a schedule, authenticated via
// the standard Vercel Cron convention: it sends `Authorization: Bearer
// $CRON_SECRET` automatically when CRON_SECRET is set as an env var — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
//
// Scheduled once/day (03:00) — Vercel's Hobby plan rejects deployment of any
// cron expression that would fire more than once a day (e.g. hourly). If you
// upgrade to Pro, a tighter schedule (e.g. hourly) would clean up abandoned
// orders sooner, but isn't required for correctness — STALE_MINUTES is
// evaluated at whatever moment this runs, so it never cancels anything that
// isn't actually stale, no matter the trigger frequency.
export const GET = withApiLogging("/api/cron/cleanup-pending-orders", async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const service = createServiceSupabase();
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await service
    .from("orders")
    .update({ status: "cancelled", payment_status: "failed" })
    .eq("status", "placed")
    .eq("payment_status", "pending")
    .lt("created_at", cutoff)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cleaned: data?.length ?? 0 });
}, { rateLimit: false });
