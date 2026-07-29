// Server-only Meta WhatsApp Cloud API adapter. Kept isolated to this one
// file so a future provider swap (BSP, Twilio, etc.) only touches here, not
// every call site.
const GRAPH_VERSION = "v20.0";

interface WhatsAppSendResult {
  ok: boolean;
  error?: string;
}

// Sends the approved "Authentication" category template with the OTP code
// filled into both the body and the "Copy Code" button. Meta auto-generates
// the wording for Authentication templates (you only choose language +
// button style when creating one) — this payload shape matches that
// template type specifically, not a general-purpose Utility/Marketing send.
export async function sendOtpWhatsapp(phone: string, code: string): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || "otp_login";

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: "WhatsApp is not configured" };
  }

  // Meta expects the recipient number without a leading "+".
  const to = phone.replace(/^\+/, "");

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error?.message ?? `WhatsApp send failed (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
