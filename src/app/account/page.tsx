"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, User as UserIcon, Check, Download, Info, ShieldCheck, FileText, RefreshCcw, Mail, ChevronRight, LogOut, Package, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SkelLine } from "@/components/skeletons";
import { SavedAddresses } from "@/components/SavedAddresses";
import { notify } from "@/store/notify";
import { usePwaInstall } from "@/store/pwaInstall";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [role, setRole] = useState<string>("buyer");
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [saving, setSaving] = useState(false);
  const deferredEvent = usePwaInstall((s) => s.deferredEvent);
  const installed = usePwaInstall((s) => s.installed);
  const setDeferredEvent = usePwaInstall((s) => s.setDeferredEvent);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    // getSession() reads the cached session locally — no network round-trip,
    // unlike getUser(). The redirect below is a client-side UX convenience;
    // actual access control is middleware/RLS-enforced regardless.
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? null);
      const { data: p } = await supabase
        .from("profiles")
        .select("role, full_name, phone")
        .eq("id", user.id)
        .single();
      if (p) {
        setRole(p.role);
        setName(p.full_name ?? "");
        setSavedName(p.full_name ?? "");
        setContactPhone(p.phone ?? null);
      }
      setLoading(false);
    });
  }, [supabase, router]);

  async function saveName() {
    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (user) {
      const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
      if (error) {
        notify.error(error.message);
      } else {
        setSavedName(name.trim());
        notify.success("Name updated");
      }
    }
    setSaving(false);
  }

  async function installApp() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const choice = await deferredEvent.userChoice;
    if (choice.outcome === "accepted") notify.success("GrabOn installed");
    setDeferredEvent(null);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <SkelLine className="h-8 w-40" />
        <div className="card space-y-4 p-5">
          <SkelLine className="h-12 w-12 rounded-full" />
          <SkelLine className="h-4 w-48" />
          <SkelLine className="h-3 w-32" />
          <SkelLine className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <SkelLine className="h-10 w-full rounded-lg" />
          <SkelLine className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md animate-fade-in space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Account</h1>
        {role !== "buyer" && (
          <span className="badge bg-brand-50 text-brand-700 uppercase text-xs font-semibold px-2.5 py-1">{role}</span>
        )}
      </div>

      {/* Profile Section */}
      <div className="card space-y-4 p-5">
        {/* Avatar & Basic Info */}
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600">
            <UserIcon className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink truncate">{savedName || "Not set"}</p>
            <p className="text-xs text-ink-soft mt-1 flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {email ?? "No email on file"}
            </p>
            {contactPhone && (
              <p className="text-xs text-ink-soft mt-0.5 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                +{contactPhone}
              </p>
            )}
          </div>
        </div>

        {/* Edit Name */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
          <input
            className="input flex-1 text-sm"
            placeholder="Update your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {name.trim() !== savedName && name.trim() && (
            <button
              onClick={saveName}
              disabled={saving}
              className="text-brand-600 hover:text-brand-700 font-medium text-sm transition"
            >
              {saving ? "…" : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold text-ink-faint uppercase tracking-wide">Quick Actions</p>
        <div className={`grid gap-3 ${role === "buyer" ? "grid-cols-1" : "grid-cols-2"}`}>
          <Link href="/orders" className="card flex flex-col items-center gap-2 p-4 text-center transition hover:bg-gray-50">
            <Package className="h-6 w-6 text-brand-600" />
            <span className="text-sm font-medium text-ink">My Orders</span>
          </Link>
          {role === "seller" && (
            <Link href="/seller" className="card flex flex-col items-center gap-2 p-4 text-center transition hover:bg-gray-50">
              <span className="text-xl">🏪</span>
              <span className="text-sm font-medium text-ink">Seller Portal</span>
            </Link>
          )}
          {role === "rider" && (
            <Link href="/rider" className="card flex flex-col items-center gap-2 p-4 text-center transition hover:bg-gray-50">
              <span className="text-xl">🚴</span>
              <span className="text-sm font-medium text-ink">Deliveries</span>
            </Link>
          )}
          {role === "admin" && (
            <Link href="/admin" className="card flex flex-col items-center gap-2 p-4 text-center transition hover:bg-gray-50 col-span-2">
              <span className="text-xl">⚙️</span>
              <span className="text-sm font-medium text-ink">Admin Console</span>
            </Link>
          )}
        </div>
      </div>

      {/* Saved Addresses Section */}
      {role === "buyer" && (
        <>
          <div className="px-1">
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide">Delivery</p>
          </div>
          <SavedAddresses />
        </>
      )}

      {/* App Installation */}
      {!installed && deferredEvent && (
        <button className="btn-primary flex w-full items-center justify-center gap-2 py-3" onClick={installApp}>
          <Download className="h-4 w-4" />
          Install App
        </button>
      )}
      {!installed && !deferredEvent && isIOS && (
        <div className="card bg-blue-50 border border-blue-200 p-4">
          <p className="text-xs text-blue-900">
            To install GrabOn: tap the <strong>Share</strong> icon, then &ldquo;Add to Home Screen&rdquo;.
          </p>
        </div>
      )}

      {/* Support & Info Section */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold text-ink-faint uppercase tracking-wide">Support & Info</p>
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {[
            { href: "/about", label: "About GrabOn", icon: Info },
            { href: "/contact", label: "Contact Us", icon: Mail },
            { href: "/refund-policy", label: "Refund & Cancellation", icon: RefreshCcw },
            { href: "/privacy", label: "Privacy Policy", icon: ShieldCheck },
            { href: "/terms", label: "Terms & Conditions", icon: FileText },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink transition hover:bg-gray-50 active:bg-gray-100"
            >
              <Icon className="h-4 w-4 shrink-0 text-ink-faint" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </Link>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <button
        className="btn-outline w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 py-3 font-medium"
        onClick={logout}
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>

      {/* Footer */}
      <p className="pb-2 text-center text-[11px] text-ink-faint">
        GrabOn · Agra, Uttar Pradesh
      </p>
    </div>
  );
}
