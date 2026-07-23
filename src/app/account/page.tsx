"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, User as UserIcon, Check, Download, Info, ShieldCheck, FileText, RefreshCcw, Mail, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SkelLine } from "@/components/skeletons";
import { notify } from "@/store/notify";
import { usePwaInstall } from "@/store/pwaInstall";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState<string | null>(null);
  const [role, setRole] = useState<string>("buyer");
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [saving, setSaving] = useState(false);
  const deferredEvent = usePwaInstall((s) => s.deferredEvent);
  const installed = usePwaInstall((s) => s.installed);
  const setDeferredEvent = usePwaInstall((s) => s.setDeferredEvent);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setPhone(data.user.phone ?? null);
      const { data: p } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .single();
      if (p) {
        setRole(p.role);
        setName(p.full_name ?? "");
        setSavedName(p.full_name ?? "");
      }
      setLoading(false);
    });
  }, [supabase, router]);

  async function saveName() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
        <SkelLine className="h-6 w-32" />
        <div className="card space-y-3 p-4">
          <SkelLine className="h-4 w-36" />
          <SkelLine className="h-5 w-16 rounded-full" />
          <SkelLine className="h-9 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SkelLine className="h-10 rounded-xl" />
          <SkelLine className="h-10 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md animate-fade-in space-y-4">
      <h1 className="text-xl font-extrabold">My account</h1>

      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-ink-faint" />
          <span className="text-ink-soft">{phone ? `+${phone}` : "No phone on file"}</span>
        </div>
        {role !== "buyer" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge bg-brand-50 text-brand-700 uppercase">{role}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <UserIcon className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={saveName}
            disabled={saving || !name.trim() || name.trim() === savedName}
            className="btn-primary shrink-0 px-3"
          >
            {saving ? "…" : <Check className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className={`grid gap-3 ${role === "buyer" ? "grid-cols-1" : "grid-cols-2"}`}>
        <Link href="/orders" className="btn-outline">My orders</Link>
        {role === "seller" && <Link href="/seller" className="btn-outline">Seller portal</Link>}
        {role === "rider" && <Link href="/rider" className="btn-outline">Delivery dashboard</Link>}
        {role === "admin" && <Link href="/admin" className="btn-outline col-span-2">Admin console</Link>}
      </div>

      {!installed && deferredEvent && (
        <button className="btn-outline flex w-full items-center justify-center gap-2" onClick={installApp}>
          <Download className="h-4 w-4" />
          Install app
        </button>
      )}
      {!installed && !deferredEvent && isIOS && (
        <p className="text-center text-xs text-ink-soft">
          To install: tap the Share icon, then &ldquo;Add to Home Screen&rdquo;.
        </p>
      )}

      <button className="btn-outline w-full text-red-600" onClick={logout}>
        Log out
      </button>

      {/* App info links */}
      <div className="card divide-y divide-gray-100 overflow-hidden">
        {[
          { href: "/about", label: "About GrabOn", icon: Info },
          { href: "/contact", label: "Contact Us", icon: Mail },
          { href: "/refund-policy", label: "Refund & Cancellation Policy", icon: RefreshCcw },
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

      <p className="pb-2 text-center text-[11px] text-ink-faint">
        GrabOn · Agra, Uttar Pradesh
      </p>
    </div>
  );
}
