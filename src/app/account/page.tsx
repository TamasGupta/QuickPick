"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, User as UserIcon, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SkelLine } from "@/components/skeletons";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState<string | null>(null);
  const [role, setRole] = useState<string>("buyer");
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [saving, setSaving] = useState(false);

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
      await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
      setSavedName(name.trim());
    }
    setSaving(false);
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

      <button className="btn-outline w-full text-red-600" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
