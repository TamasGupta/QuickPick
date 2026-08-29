"use client";

import { useState, ChangeEvent, ForwardedRef, useImperativeHandle, useRef } from "react";
import { Phone } from "lucide-react";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  ref?: ForwardedRef<{ focus: () => void }>;
}

export const PhoneInput = ({
  value,
  onChange,
  error,
  disabled,
  autoFocus,
  ref,
}: PhoneInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }), []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(digits);
  };

  const formattedValue = value.replace(/(\d{0,5})(\d{0,5})/, (_, a, b) =>
    b ? `${a} ${b}` : a
  );

  return (
    <div className="relative">
      <div
        className={`flex items-stretch overflow-hidden rounded-xl border ${
          error
            ? "border-red-400 focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-100"
            : "border-gray-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100"
        }`}
      >
        <span className="flex items-center bg-gray-50 px-3 text-sm font-semibold text-ink-soft">
          <Phone className="h-4 w-4 mr-1" /> +91
        </span>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          maxLength={15}
          placeholder="98765 43210"
          className="w-full px-3 py-2.5 text-sm outline-none"
          value={formattedValue}
          onChange={handleChange}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? "true" : "false"}
        />
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
};