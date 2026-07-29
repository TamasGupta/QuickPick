"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User, Mail, Phone, ShieldCheck, ArrowLeft, TriangleAlert, Sparkles, ShoppingBag, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/store/notify";

const RESEND_SECONDS = 60;
const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_OTP_ENABLED === "true";

// WhatsApp OTP (Meta Cloud API) is on hold — it requires a verified Meta
// Business account we don't currently have. See the matching comment in
// src/app/login/page.tsx and lib/whatsapp.ts / /api/auth/whatsapp/*.
// const WHATSAPP_MODE = !STATIC_MODE && process.env.NEXT_PUBLIC_WHATSAPP_OTP_ENABLED === "true";

function RegisterForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [step, setStep] = useState<"details" | "otp" | "success">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === "otp") otpRef.current?.focus();
  }, [step]);

  // Check if user is already logged in with a full name set
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", data.user.id)
        .single();

      if (profile?.full_name) {
        notify.info("You are already logged in.");
        router.replace(profile.role === "buyer" ? next : `/${profile.role}`);
      }
    });
  }, [supabase, router, next]);

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      notify.error("Please enter your full name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      notify.error("Enter a valid email address.");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      notify.error("Enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);

    try {
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail() }),
      });
      const checkData = await checkRes.json();

      if (checkRes.ok && checkData.exists) {
        setLoading(false);
        notify.error("An account with this email already exists. Please log in instead.");
        return;
      }
    } catch {
      // If check endpoint fails, continue gracefully
    }

    if (STATIC_MODE) {
      setLoading(false);
      setStep("otp");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail() });
    setLoading(false);

    if (error) {
      notify.error(error.message);
      return;
    }

    setStep("otp");
    setResendIn(RESEND_SECONDS);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      notify.error("Enter the 6-digit code.");
      return;
    }

    setLoading(true);

    let userId: string | null = null;

    if (STATIC_MODE) {
      const res = await fetch("/api/auth/static-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail(), code: otp }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoading(false);
        notify.error(json.error ?? "Verification failed");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        notify.error("Registration failed — please try again.");
        return;
      }
      userId = user.id;
    } else {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail(),
        token: otp,
        type: "email",
      });
      if (error || !data.user) {
        setLoading(false);
        notify.error(error?.message ?? "Verification failed");
        return;
      }
      userId = data.user.id;
    }

    if (userId) {
      const trimmedName = name.trim();
      // phone is plain contact info here (no OTP/verification gate) — kept
      // so the existing buyer<->rider delivery-call feature keeps working
      // now that auth itself no longer runs through phone (see migration
      // 018). Stored with the "91" prefix, no "+", matching the format the
      // old phone-auth flow used to write (profiles.phone = phone.replace
      // ("+", "")) — every existing display of this field expects that shape.
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName, phone: `91${phone}` })
        .eq("id", userId);

      if (updateError) {
        notify.error(updateError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setStep("success");
  }

  function finishRegistration() {
    router.replace(next);
    router.refresh();
  }

  const currentStepNum = step === "details" ? 1 : step === "otp" ? 2 : 3;

  return (
    <div className="mx-auto max-w-sm py-8">
      {STATIC_MODE && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          Static OTP mode — email delivery is temporarily disabled for testing.
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-between px-2">
        {[
          { num: 1, label: "Details" },
          { num: 2, label: "Verify" },
          { num: 3, label: "Welcome" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  currentStepNum === s.num
                    ? "bg-brand-600 text-white ring-4 ring-brand-100"
                    : currentStepNum > s.num
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-ink-faint"
                }`}
              >
                {currentStepNum > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
              </div>
              <span
                className={`text-xs font-semibold ${
                  currentStepNum === s.num
                    ? "text-brand-600"
                    : currentStepNum > s.num
                    ? "text-emerald-600"
                    : "text-ink-faint"
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < 2 && (
              <div
                className={`mx-2 h-0.5 flex-1 transition-all ${
                  currentStepNum > idx + 1 ? "bg-emerald-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card animate-fade-in p-6">
        {step === "details" && (
          <>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Sparkles className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold text-ink">Create your account</h1>
            <p className="mt-1 text-sm text-ink-faint">
              Join GrabOn for superfast grocery deliveries.
            </p>

            <form onSubmit={handleSendOtp} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-ink-faint" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Enter your name"
                    className="input pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-ink-faint" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="input pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Mobile Number</label>
                <p className="mb-1 text-[11px] text-ink-faint">
                  Used to reach you about deliveries — not for login.
                </p>
                <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                  <span className="flex items-center bg-gray-50 px-3 text-sm font-semibold text-ink-soft">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    placeholder="98765 43210"
                    className="w-full px-3 py-2.5 text-sm outline-none"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                </div>
              </div>

              <button className="btn-primary w-full py-3 mt-2" disabled={loading}>
                {loading ? "Sending OTP…" : STATIC_MODE ? "Continue to Verify" : "Get Verification Code"}
              </button>

              <div className="pt-2 text-center text-xs text-ink-soft">
                Already have an account?{" "}
                <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-600 hover:underline">
                  Log in
                </Link>
              </div>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <button
              onClick={() => {
                setStep("details");
                setOtp("");
              }}
              className="mb-2 flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" /> Edit details
            </button>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold text-ink">Verify your email</h1>
            <p className="mt-1 text-sm text-ink-faint">
              {STATIC_MODE
                ? "Enter the shared testing code."
                : `Enter the 6-digit verification code sent to ${email}`}
            </p>

            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3">
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="••••••"
                className="input text-center text-lg tracking-[0.5em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Verifying…" : "Complete Registration"}
              </button>
              {!STATIC_MODE && (
                <button
                  type="button"
                  onClick={() => handleSendOtp({ preventDefault: () => {} } as React.FormEvent)}
                  disabled={resendIn > 0 || loading}
                  className="w-full text-center text-sm text-brand-700 disabled:text-ink-faint"
                >
                  {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                </button>
              )}
            </form>
          </>
        )}

        {step === "success" && (
          <div className="text-center py-4 space-y-4 animate-bounce-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Sparkles className="h-8 w-8 animate-float" />
            </div>
            <h1 className="text-2xl font-extrabold text-ink">Welcome to GrabOn, {name}! 🎉</h1>
            <p className="text-sm text-ink-soft max-w-xs mx-auto">
              Your account has been created successfully. Browse fresh groceries and get them delivered in minutes!
            </p>
            <div className="pt-2">
              <button
                onClick={finishRegistration}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base font-bold shadow-pop"
              >
                <ShoppingBag className="h-5 w-5" />
                Start Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
