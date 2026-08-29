"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      className="btn-outline flex items-center gap-2 text-red-600 hover:bg-red-50 py-2 px-3 font-medium"
      onClick={logout}
    >
      <LogOut className="h-4 w-4" />
      Log out
    </button>
  );
}