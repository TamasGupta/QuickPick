"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [isSignup, setIsSignup] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/` },
        });
        if (error) throw error;
        setMsg("Check your email for the magic link ✉️");
      } else if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card p-6">
        <h1 className="text-xl font-extrabold text-brand-700">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Login to order or to manage your store.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="email"
            required
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode === "password" && (
            <input
              type="password"
              required
              className="input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <button className="btn-primary w-full" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "magic"
              ? "Send magic link"
              : isSignup
              ? "Sign up"
              : "Login"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm text-brand-700">{msg}</p>}

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            className="text-brand-700"
            onClick={() => setMode(mode === "magic" ? "password" : "magic")}
          >
            {mode === "magic" ? "Use password" : "Use magic link"}
          </button>
          {mode === "password" && (
            <button className="text-brand-700" onClick={() => setIsSignup(!isSignup)}>
              {isSignup ? "Have an account? Login" : "New? Sign up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
