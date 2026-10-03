// Server-only Evolution Go API client

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;

interface EvolutionInstance {
  id: string;
  name: string;
  token: string;
  webhook?: string;
  connected: boolean;
  qrcode?: string;
  jid?: string;
}

/**
 * Generic request helper
 */
async function evolutionFetch<T>(
  path: string,
  options: RequestInit = {},
  apiKey: string = EVOLUTION_API_KEY,
): Promise<T> {
  const url = `${EVOLUTION_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();

  let data: any = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `Evolution Go API error: ${response.status}`,
    );
  }

  return data as T;
}

/**
 * Get all Evolution Go instances
 */
async function getAllInstances(): Promise<EvolutionInstance[]> {
  const response = await evolutionFetch<{
    data: EvolutionInstance[];
    message?: string;
  }>("/instance/all");

  return response.data || [];
}

/**
 * Get existing instance or create a new one
 */
export async function getOrCreateInstance(
  instanceName: string,
): Promise<EvolutionInstance> {
  const instances = await getAllInstances();

  const existing = instances.find((instance) => instance.name === instanceName);

  if (existing) {
    return existing;
  }

  const instanceToken = crypto.randomUUID();

  const response = await evolutionFetch<{
    data: EvolutionInstance;
    message?: string;
  }>("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      name: instanceName,
      token: instanceToken,
    }),
  });

  return response.data;
}

/**
 * Get instance token
 */
async function getInstanceToken(instanceName: string): Promise<string> {
  const instances = await getAllInstances();

  const instance = instances.find((item) => item.name === instanceName);

  if (!instance) {
    throw new Error(`Evolution Go instance "${instanceName}" not found`);
  }

  if (!instance.token) {
    throw new Error(`Evolution Go instance "${instanceName}" has no token`);
  }

  return instance.token;
}

/**
 * Connect instance
 */
export async function connectInstance(instanceName: string): Promise<void> {
  const instanceToken = await getInstanceToken(instanceName);

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/evolution`
    : undefined;

  const body: Record<string, unknown> = {};

  if (webhookUrl) {
    body.webhookUrl = webhookUrl;
    body.subscribe = ["messages.upsert", "connection.update"];
  }

  await evolutionFetch(
    "/instance/connect",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    instanceToken,
  );
}

/**
 * Get QR code
 */
export async function getInstanceQrCode(
  instanceName: string,
): Promise<{ base64: string; code: string }> {
  const instanceToken = await getInstanceToken(instanceName);

  const response = await evolutionFetch<{
    data: {
      qrcode: string;
      code: string;
    };
  }>("/instance/qr", {}, instanceToken);

  const qrcode = response.data?.qrcode || "";
  const code = response.data?.code || "";

  let base64 = qrcode;

  if (base64.startsWith("data:image")) {
    base64 = base64.replace(/^data:image\/png;base64,/, "");
  }

  if (!base64 && code.startsWith("data:image")) {
    base64 = code.replace(/^data:image\/png;base64,/, "");
  }

  return {
    base64,
    code,
  };
}

/**
 * Get instance connection status
 */
export async function getInstanceStatus(
  instanceName: string,
): Promise<{ state: string }> {
  const instanceToken = await getInstanceToken(instanceName);

  const response = await evolutionFetch<{
    data: {
      connected: boolean;
      loggedIn: boolean;
    };
  }>("/instance/status", {}, instanceToken);

  const data = response.data;

  if (data.connected && data.loggedIn) {
    return { state: "open" };
  }

  if (data.connected) {
    return { state: "connecting" };
  }

  return { state: "close" };
}

/**
 * Send WhatsApp text message
 */
export async function sendTextMessage(
  instanceName: string,
  number: string,
  text: string,
): Promise<void> {
  const instanceToken = await getInstanceToken(instanceName);

  const cleanNumber = number.replace(/\D/g, "");

  await evolutionFetch(
    "/send/text",
    {
      method: "POST",
      body: JSON.stringify({
        number: cleanNumber,
        text,
      }),
    },
    instanceToken,
  );
}

/**
 * Send button message
 */
export async function sendButtonMessage(
  instanceName: string,
  number: string,
  bodyText: string,
  buttonText: string,
  buttonId: string,
): Promise<void> {
  const instanceToken = await getInstanceToken(instanceName);

  const cleanNumber = number.replace(/\D/g, "");

  await evolutionFetch(
    "/send/button",
    {
      method: "POST",
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
    },
    instanceToken,
  );
}

/**
 * Delete instance
 */
export async function deleteInstance(instanceName: string): Promise<void> {
  const instances = await getAllInstances();

  const instance = instances.find((item) => item.name === instanceName);

  if (!instance) {
    return;
  }

  await evolutionFetch(
    `/instance/delete/${instance.id}`,
    {
      method: "DELETE",
    },
    EVOLUTION_API_KEY,
  );
}

/**
 * Logout instance
 */
export async function logoutInstance(instanceName: string): Promise<void> {
  const instanceToken = await getInstanceToken(instanceName);

  await evolutionFetch(
    "/instance/logout",
    {
      method: "DELETE",
    },
    instanceToken,
  );
}
