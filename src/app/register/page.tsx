"use client";

import { Suspense } from "react";
import { WhatsAppLogin } from "@/components/WhatsAppLogin";

function RegisterForm() {
  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card animate-fade-in p-6">
        <WhatsAppLogin mode="register" onSwitchToEmail={() => {}} />
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