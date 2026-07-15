// Normalizes a 10-digit Indian mobile number (with or without +91) to the
// E.164 format Supabase Auth expects.
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return `+91${last10}`;
}
