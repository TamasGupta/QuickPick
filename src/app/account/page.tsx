"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>("buyer");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setEmail(data.user.email ?? null);
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (p) setRole(p.role);
    });
  }, [supabase, router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-extrabold">My account</h1>
      <div className="card space-y-1 p-4 text-sm">
        <p><span className="text-gray-500">Email:</span> {email}</p>
        <p><span className="text-gray-500">Role:</span> <span className="uppercase">{role}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/orders" className="btn-outline">My orders</Link>
        <Link href="/seller" className="btn-outline">Seller portal</Link>
        {role === "admin" && <Link href="/admin" className="btn-outline col-span-2">Admin console</Link>}
      </div>

      <button className="btn-outline w-full text-red-600" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
