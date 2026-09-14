"use client";

import { Suspense } from "react";
import Link from "next/link";
import { WhatsAppLogin } from "@/components/WhatsAppLogin";

function LoginForm() {
  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card animate-fade-in p-6">
        <WhatsAppLogin mode="login" onSwitchToEmail={() => {}} showEmailOption={false} />
      </div>
      <p className="mt-4 text-center text-sm text-ink-faint">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}