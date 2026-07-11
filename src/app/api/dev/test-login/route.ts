import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// DEV-ONLY test helper: signs in with phone+password so the app can be
// exercised end-to-end without a real SMS provider configured. The
// production login UI never collects a password — this route exists purely
// for local/dev verification and is disabled outside development.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const { phone, email, password } = (await req.json()) as {
    phone?: string;
    email?: string;
    password?: string;
  };
  if ((!phone && !email) || !password) {
    return NextResponse.json({ error: "phone or email, plus password, required" }, { status: 400 });
  }
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(
    email ? { email, password } : { phone: phone!, password }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });
  return NextResponse.json({ ok: true });
}
