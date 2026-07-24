"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MapPin, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SellerNav } from "@/components/SellerNav";
import { SkelLine } from "@/components/skeletons";
import { notify } from "@/store/notify";
import type { Seller, StoreHour } from "@/lib/types";
import type { PickedLocation } from "@/components/LocationPicker";

const LocationPicker = dynamic(() => import("@/components/LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center rounded-xl bg-gray-50 text-sm text-ink-faint">Loading map…</div>,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const TIMEZONES = [
  { value: "Asia/Kolkata",        label: "India Standard Time (IST, UTC+5:30)" },
  { value: "Asia/Dubai",          label: "Gulf Standard Time (GST, UTC+4)" },
  { value: "Asia/Singapore",      label: "Singapore Time (SGT, UTC+8)" },
  { value: "Asia/Tokyo",          label: "Japan Standard Time (JST, UTC+9)" },
  { value: "Europe/London",       label: "Greenwich Mean Time (GMT, UTC+0)" },
  { value: "Europe/Paris",        label: "Central European Time (CET, UTC+1)" },
  { value: "America/New_York",    label: "Eastern Time (ET, UTC-5/-4)" },
  { value: "America/Chicago",     label: "Central Time (CT, UTC-6/-5)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT, UTC-8/-7)" },
  { value: "Australia/Sydney",    label: "Australian Eastern Time (AET, UTC+11)" },
];

// One entry per day (index 0=Sun … 6=Sat)
type DayForm = {
  is_closed: boolean;
  opens_at: string;   // "HH:MM" or ""
  closes_at: string;  // "HH:MM" or ""
};

const DEFAULT_DAY: DayForm = { is_closed: false, opens_at: "", closes_at: "" };

function makeDefaultSchedule(): DayForm[] {
  return Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY }));
}

// Convert a DB "HH:MM:SS" string to the "HH:MM" format time inputs need.
function dbTimeToInput(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5); // "09:00:00" → "09:00"
}

// Format "HH:MM" as "9:00 AM" for the live preview.
function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// Compute the "current" open/closed status locally (for the live preview only —
// the authoritative check is always done by Postgres in is_store_open()).
function computeLocalIsOpen(schedule: DayForm[], timezone: string): boolean {
  try {
    const now = new Date();
    const localStr = now.toLocaleString("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
    // weekday map
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const wdMatch = localStr.match(/^(\w+),/);
    if (!wdMatch) return true;
    const dow = weekdays.indexOf(wdMatch[1]);
    if (dow === -1) return true;
    const day = schedule[dow];
    if (day.is_closed) return false;

    const timeStr = now.toLocaleString("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false });
    const parts = timeStr.match(/(\d+):(\d+)/);
    if (!parts) return true;
    const [, hh, mm] = parts;
    const nowMinutes = parseInt(hh) * 60 + parseInt(mm);

    if (day.opens_at) {
      const [oh, om] = day.opens_at.split(":").map(Number);
      if (nowMinutes < oh * 60 + om) return false;
    }
    if (day.closes_at) {
      const [ch, cm] = day.closes_at.split(":").map(Number);
      if (nowMinutes >= ch * 60 + cm) return false;
    }
    return true;
  } catch {
    return true;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SellerSettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [form, setForm] = useState({ store_name: "", address_line: "", city: "", state: "", pincode: "" });
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);

  // Store hours state
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [schedule, setSchedule] = useState<DayForm[]>(makeDefaultSchedule());
  const [hoursLoaded, setHoursLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      const { data: s } = await supabase.from("sellers").select("*").eq("owner_id", data.user.id).maybeSingle();
      if (s) {
        const seller = s as Seller;
        setSeller(seller);
        setForm({
          store_name: seller.store_name,
          address_line: seller.address_line ?? "",
          city: seller.city ?? "",
          state: seller.state ?? "",
          pincode: seller.pincode ?? "",
        });
        if (seller.lat != null && seller.lng != null) {
          setPicked({ lat: seller.lat, lng: seller.lng, city: seller.city, state: seller.state, pincode: seller.pincode });
        }
        setTimezone(seller.timezone ?? "Asia/Kolkata");

        // Load per-day schedule
        const { data: rows } = await supabase
          .from("store_hours")
          .select("*")
          .eq("seller_id", seller.id)
          .order("day_of_week");

        const newSchedule = makeDefaultSchedule();
        if (rows && rows.length > 0) {
          (rows as StoreHour[]).forEach((r) => {
            newSchedule[r.day_of_week] = {
              is_closed: r.is_closed,
              opens_at: dbTimeToInput(r.opens_at),
              closes_at: dbTimeToInput(r.closes_at),
            };
          });
        }
        setSchedule(newSchedule);
        setHoursLoaded(true);
      }
      setLoading(false);
    });
  }, [supabase, router]);

  function setDay(idx: number, patch: Partial<DayForm>) {
    setSchedule((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!seller) return;
    setSaving(true);
    try {
      // 1. Save store details + timezone
      const update = {
        ...form,
        timezone,
        lat: picked?.lat ?? null,
        lng: picked?.lng ?? null,
      };
      const { error: sellerErr } = await supabase.from("sellers").update(update).eq("id", seller.id);
      if (sellerErr) throw sellerErr;

      // 2. Upsert 7 store_hours rows (one per day)
      const hoursRows = schedule.map((d, i) => ({
        seller_id: seller.id,
        day_of_week: i,
        is_closed: d.is_closed,
        opens_at: d.opens_at || null,
        closes_at: d.closes_at || null,
      }));
      const { error: hoursErr } = await supabase
        .from("store_hours")
        .upsert(hoursRows, { onConflict: "seller_id,day_of_week" });
      if (hoursErr) throw hoursErr;

      notify.success("Store details updated");
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Live preview — computed purely client-side (not authoritative)
  const previewOpen = hoursLoaded ? computeLocalIsOpen(schedule, timezone) : null;

  if (loading) {
    return (
      <div>
        <SellerNav />
        <div className="card mx-auto max-w-md space-y-3 p-4">
          <SkelLine className="h-4 w-36" />
          <SkelLine className="h-9 w-full rounded-xl" />
          <SkelLine className="h-9 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div>
        <SellerNav />
        <p className="text-sm text-ink-soft">This account isn't set up as a seller.</p>
      </div>
    );
  }

  return (
    <div>
      <SellerNav />
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-xl font-extrabold">Store settings</h1>

        {/* ── Store details ── */}
        <form onSubmit={save} id="settings-form" className="card grid grid-cols-2 gap-2 p-4">
          <input
            className="input col-span-2"
            placeholder="Store name"
            required
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
          />
          <input
            className="input col-span-2"
            placeholder="Address line"
            value={form.address_line}
            onChange={(e) => setForm({ ...form, address_line: e.target.value })}
          />
          <input
            className="input"
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <input
            className="input"
            placeholder="State"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          />
          <input
            className="input col-span-2"
            placeholder="Pincode"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
          />

          {showMap ? (
            <div className="col-span-2">
              <LocationPicker
                initialLat={picked?.lat}
                initialLng={picked?.lng}
                onCancel={() => setShowMap(false)}
                onConfirm={(loc) => {
                  setPicked(loc);
                  setForm((f) => ({
                    ...f,
                    city: loc.city || f.city,
                    state: loc.state || f.state,
                    pincode: loc.pincode || f.pincode,
                  }));
                  setShowMap(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className={`btn-outline col-span-2 ${picked ? "border-brand-500 text-brand-700" : ""}`}
            >
              <MapPin className="h-4 w-4" />
              {picked ? "Store location pinned — tap to adjust" : "Pin store location on map"}
            </button>
          )}
          <p className="col-span-2 -mt-1 text-[11px] text-ink-faint">
            Pinning your store's exact location improves delivery distance estimates for buyers.
          </p>
        </form>

        {/* ── Store hours ── */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-ink-faint" />
              <h2 className="font-bold">Store hours</h2>
            </div>
            {/* Live preview pill */}
            {hoursLoaded && previewOpen !== null && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  previewOpen
                    ? "bg-brand-50 text-brand-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${previewOpen ? "bg-brand-500" : "bg-red-500"}`} />
                {previewOpen ? "Open now" : "Closed now"}
              </span>
            )}
          </div>

          {/* Timezone */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-faint uppercase tracking-wide">
              Timezone
            </label>
            <select
              className="input w-full"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Per-day grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-ink-faint uppercase tracking-wide">
                  <th className="pb-2 pr-3 w-24">Day</th>
                  <th className="pb-2 pr-3 w-24">Status</th>
                  <th className="pb-2 pr-3">Opens at</th>
                  <th className="pb-2">Closes at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedule.map((day, i) => (
                  <tr key={i} className="group">
                    <td className="py-2 pr-3 font-medium text-ink">
                      <span className="hidden sm:inline">{DAYS[i]}</span>
                      <span className="sm:hidden">{DAY_SHORT[i]}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => setDay(i, { is_closed: !day.is_closed })}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                          day.is_closed
                            ? "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600"
                            : "bg-brand-50 text-brand-700 hover:bg-gray-100 hover:text-gray-500"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${day.is_closed ? "bg-gray-400" : "bg-brand-500"}`} />
                        {day.is_closed ? "Closed" : "Open"}
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      {!day.is_closed ? (
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="time"
                            className="input w-32 text-sm py-1"
                            value={day.opens_at}
                            onChange={(e) => setDay(i, { opens_at: e.target.value })}
                          />
                          {day.opens_at && (
                            <span className="text-[10px] text-ink-faint">{formatTime(day.opens_at)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-faint text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      {!day.is_closed ? (
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="time"
                            className="input w-32 text-sm py-1"
                            value={day.closes_at}
                            onChange={(e) => setDay(i, { closes_at: e.target.value })}
                          />
                          {day.closes_at && (
                            <span className="text-[10px] text-ink-faint">{formatTime(day.closes_at)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-faint text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-ink-faint">
            Leave opens/closes blank for a day to treat it as open all day. Buyers will see a closed notice if they try to order outside these hours.
          </p>
        </div>

        <button form="settings-form" className="btn-primary w-full" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
