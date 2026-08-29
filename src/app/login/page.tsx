"use client";

import { Suspense } from "react";
import { WhatsAppLogin } from "@/components/WhatsAppLogin";

function LoginForm() {
  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card animate-fade-in p-6">
        <WhatsAppLogin mode="login" onSwitchToEmail={() => {}} />
      </div>
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