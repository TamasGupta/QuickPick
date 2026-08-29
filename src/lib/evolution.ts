// Server-only Evolution Go API client
const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;

interface EvolutionInstance {
  id: string;
  name: string;
  token: string;
  webhook: string;
  connected: boolean;
  qrcode?: string;
}

interface EvolutionResponse<T> {
  data?: T;
  message?: string;
  qrcode?: { base64: string; code: string };
}

async function evolutionFetch<T>(path: string, options: RequestInit = {}, useInstanceToken = false): Promise<T> {
  const url = `${EVOLUTION_BASE_URL}${path}`;
  const token = useInstanceToken ? EVOLUTION_API_KEY : EVOLUTION_API_KEY;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: token,
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Evolution API error: ${res.status}`);
  }
  return res.json();
}

// Create or get instance for a user
export async function getOrCreateInstance(instanceName: string): Promise<EvolutionInstance> {
  // First try to find existing instance by name via /instance/all
  try {
    const all = await evolutionFetch<{ data: EvolutionInstance[] }>(`/instance/all`, {}, true);
    const existing = all.data.find((i) => i.name === instanceName);
    if (existing) return existing;
  } catch {
    // Continue to create if list fails
  }

  // Try to create new instance
  try {
    const created = await evolutionFetch<{ data: EvolutionInstance }>(`/instance/create`, {
      method: 'POST',
      body: JSON.stringify({ 
        name: instanceName, 
        token: EVOLUTION_API_KEY,
        integration: 'WHATSAPP-BAILEYS' 
      }),
    }, true);
    return created.data;
  } catch (createErr) {
    // If instance already exists, fetch from list
    if ((createErr as Error).message.includes('already exists')) {
      const all = await evolutionFetch<{ data: EvolutionInstance[] }>(`/instance/all`, {}, true);
      const existing = all.data.find((i) => i.name === instanceName);
      if (existing) return existing;
    }
    throw createErr;
  }
}

// Get QR code for pairing (uses instance token auth)
export async function getInstanceQrCode(instanceName: string): Promise<{ base64: string; code: string }> {
  // First connect to get QR with webhook
  await evolutionFetch(`/instance/connect`, {
    method: 'POST',
    body: JSON.stringify({
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/evolution`,
      subscribe: ['messages', 'connection.update'],
    }),
  }, true);
  
  // Then get QR code
  const res = await evolutionFetch<{ data: { qrcode: string; code: string } }>(`/instance/qr`, {}, true);
  // Extract base64 from data URL
  const base64 = res.data.qrcode.replace(/^data:image\/png;base64,/, '');
  return { base64, code: res.data.code };
}

// Get instance connection status (uses instance token auth)
export async function getInstanceStatus(instanceName: string): Promise<{ state: string }> {
  const res = await evolutionFetch<{ data: { Connected: boolean; LoggedIn: boolean } }>(`/instance/status`, {}, true);
  const state = res.data.Connected ? 'open' : res.data.LoggedIn ? 'connecting' : 'close';
  return { state };
}

// Send text message (for OTP) - uses instance token auth
export async function sendTextMessage(instanceName: string, number: string, text: string): Promise<void> {
  const cleanNumber = number.replace(/\D/g, '');
  await evolutionFetch(`/send/text`, {
    method: 'POST',
    body: JSON.stringify({
      number: cleanNumber,
      text,
    }),
  }, true);
}

// Send button message (for OTP with copy button) - uses instance token auth
export async function sendButtonMessage(
  instanceName: string,
  number: string,
  bodyText: string,
  buttonText: string,
  buttonId: string
): Promise<void> {
  const cleanNumber = number.replace(/\D/g, '');
  await evolutionFetch(`/send/button`, {
    method: 'POST',
    body: JSON.stringify({
      number: cleanNumber,
      body: bodyText,
      buttons: [
        {
          type: "reply",
          reply: {
            id: buttonId,
            title: buttonText,
          },
        },
      ],
    }),
  }, true);
}

// Delete instance (cleanup) - uses admin token
export async function deleteInstance(instanceName: string): Promise<void> {
  await evolutionFetch(`/instance/delete/${instanceName}`, { method: 'DELETE' }, true);
}

// Logout instance - uses instance token auth
export async function logoutInstance(instanceName: string): Promise<void> {
  await evolutionFetch(`/instance/logout`, { method: 'DELETE' }, true);
}