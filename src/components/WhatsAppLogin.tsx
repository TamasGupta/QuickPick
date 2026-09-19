"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { notify } from "@/store/notify";
import { PhoneInput } from "@/components/PhoneInput";

interface WhatsAppLoginProps {
  mode: "login" | "register";
  onSwitchToEmail: () => void;
  initialName?: string;
  showEmailOption?: boolean;
}

const RESEND_SECONDS = 60;

export function WhatsAppLogin({
  mode,
  onSwitchToEmail,
  initialName = "",
  showEmailOption = true,
}: WhatsAppLoginProps) {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [step, setStep] = useState<"phone" | "otp" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const destinationFor = (role: string | undefined) => {
    if (role === "admin") return "/admin";
    if (role === "seller") return "/seller";
    if (role === "rider") return "/rider";
    return next;
  };

  const startResendTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendIn(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setResendIn((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);

    try {
      const phoneE164 = `+91${phone}`;
      const res = await fetch("/api/auth/evolution/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send OTP");

      setStep("otp");
      startResendTimer();
    } catch (err) {
      setLoading(false);
      setError((err as Error).message ?? "Failed to send OTP");
    } finally {
      // Safety net: ensure loading is reset if step didn't change
      if (step === "phone") setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code");
      return;
    }

    setLoading(true);

    try {
      const phoneE164 = `+91${phone}`;
      const res = await fetch("/api/auth/evolution/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");

      setVerifiedUserId(data.userId);
      await afterVerified(data.userId);
    } catch (err) {
      setLoading(false);
      setError((err as Error).message ?? "Verification failed");
    }
  };

  const afterVerified = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .single();

    if (!profile?.full_name) {
      const typedName = name.trim();
      if (typedName) {
        await supabase
          .from("profiles")
          .update({ full_name: typedName })
          .eq("id", userId);
        router.replace(destinationFor(profile?.role));
        router.refresh();
        return;
      }
      setLoading(false);
      setStep("name");
      return;
    }

    // Ensure loading is reset before navigation (in case navigation is delayed)
    setLoading(false);
    router.replace(destinationFor(profile.role));
    router.refresh();
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!verifiedUserId) {
      setError("Session expired. Please try again.");
      return;
    }
    setLoading(true);
    await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", verifiedUserId);
    router.replace(next);
    router.refresh();
  };

  const handleResendOtp = async () => {
    const phoneE164 = `+91${phone}`;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/evolution/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resend OTP");
      startResendTimer();
    } catch (err) {
      setError((err as Error).message ?? "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-8">
      {step === "phone" && (
        <>
          {showEmailOption && (
            <button
              onClick={onSwitchToEmail}
              className="mb-2 flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" /> Use email instead
            </button>
          )}
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold text-ink">
            {mode === "login" ? "Log in" : "Create account"} with WhatsApp
          </h1>
          <p className="mt-1 text-sm text-ink-faint">
            {mode === "login"
              ? "We'll send you a verification code via WhatsApp"
              : "Enter your mobile number to continue"}
          </p>

          <form onSubmit={handleSendOtp} className="mt-4 space-y-3">
            <PhoneInput
              value={phone}
              onChange={setPhone}
              error={error}
              disabled={loading}
              autoFocus
            />
            <button className="btn-primary w-full py-3" disabled={loading}>
              {loading
                ? "Sending…"
                : mode === "login"
                  ? "Send code via WhatsApp"
                  : "Get Started"}
            </button>
            {showEmailOption && (
              <div className="pt-2 text-center text-xs text-ink-soft">
                {mode === "login"
                  ? "Prefer email? "
                  : "Already have an account? "}
                <button
                  type="button"
                  onClick={onSwitchToEmail}
                  className="font-semibold text-brand-600 hover:underline"
                >
                  {mode === "login" ? "Use email" : "Log in"}
                </button>
              </div>
            )}
          </form>
        </>
      )}

      {step === "otp" && (
        <>
          <button
            onClick={() => { setStep("phone"); setVerifiedUserId(null); }}
            className="mb-2 flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Change number
          </button>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold text-ink">
            Verify your number
          </h1>
          <p className="mt-1 text-sm text-ink-faint">
            Enter the 6-digit code sent via WhatsApp
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
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
            />
            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
            <button className="btn-primary w-full py-3" disabled={loading}>
              {loading
                ? "Verifying…"
                : mode === "login"
                  ? "Verify & continue"
                  : "Complete Registration"}
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendIn > 0 || loading}
              className="w-full text-center text-sm text-brand-700 disabled:text-ink-faint"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </form>
        </>
      )}

      {step === "name" && (
        <>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Loader2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold text-ink">
            What should we call you?
          </h1>
          <p className="mt-1 text-sm text-ink-faint">
            This helps sellers and delivery partners identify you.
          </p>

          <form onSubmit={handleSaveName} className="mt-4 space-y-3">
            <input
              autoFocus
              required
              placeholder="Your name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
            <button className="btn-primary w-full py-3" disabled={loading}>
              {loading ? "Saving…" : "Continue"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
