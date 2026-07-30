/**
 * Mobile Money provider adapter (server-only).
 *
 * All credentials come from secure backend configuration — nothing is
 * hard-coded. Configure these secrets and the flow works with no redesign:
 *
 *   MOMO_API_BASE_URL   e.g. https://api.provider.rw/v1
 *   MOMO_API_KEY        API key / bearer token
 *   MOMO_API_SECRET     API secret (optional, depends on provider)
 *   MOMO_MERCHANT_ID    merchant / account id (optional)
 *   MOMO_CALLBACK_URL   webhook URL the provider calls back
 *   MOMO_WEBHOOK_SECRET shared secret used to verify webhook signatures
 *   MOMO_CHARGE_PATH    optional override, default /payments/request-to-pay
 *   MOMO_STATUS_PATH    optional override, default /payments/status
 */

export type MomoConfig = {
  baseUrl: string;
  apiKey: string;
  apiSecret?: string;
  merchantId?: string;
  callbackUrl?: string;
  chargePath: string;
  statusPath: string;
};

export function getMomoConfig(): MomoConfig | null {
  const baseUrl = process.env.MOMO_API_BASE_URL;
  const apiKey = process.env.MOMO_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    apiSecret: process.env.MOMO_API_SECRET || undefined,
    merchantId: process.env.MOMO_MERCHANT_ID || undefined,
    callbackUrl: process.env.MOMO_CALLBACK_URL || undefined,
    chargePath: process.env.MOMO_CHARGE_PATH || "/payments/request-to-pay",
    statusPath: process.env.MOMO_STATUS_PATH || "/payments/status",
  };
}

function authHeaders(cfg: MomoConfig): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.apiSecret) h["X-API-Secret"] = cfg.apiSecret;
  if (cfg.merchantId) h["X-Merchant-Id"] = cfg.merchantId;
  return h;
}

export type ProviderStatus = "pending" | "success" | "failed";

export function normalizeStatus(value: unknown): ProviderStatus {
  const s = String(value ?? "").toLowerCase();
  if (["success", "successful", "succeeded", "completed", "paid", "accepted"].includes(s)) return "success";
  if (["failed", "failure", "rejected", "cancelled", "canceled", "declined", "expired", "timeout"].includes(s))
    return "failed";
  return "pending";
}

function readStatus(payload: Record<string, unknown>): ProviderStatus {
  const candidate =
    payload.status ?? payload.state ?? payload.transaction_status ?? (payload.data as Record<string, unknown>)?.status;
  return normalizeStatus(candidate);
}

function readRef(payload: Record<string, unknown>): string | null {
  const data = (payload.data as Record<string, unknown>) ?? {};
  const v =
    payload.transaction_id ??
    payload.transactionId ??
    payload.reference ??
    payload.id ??
    data.transaction_id ??
    data.reference ??
    data.id;
  return v ? String(v) : null;
}

export type ChargeResult = {
  ok: boolean;
  status: ProviderStatus;
  providerRef: string | null;
  message: string | null;
  raw: Record<string, unknown>;
};

/** Trigger the real Mobile Money PIN prompt on the customer's phone. */
export async function requestToPay(args: {
  amount: number;
  phone: string;
  externalRef: string;
  description: string;
}): Promise<ChargeResult> {
  const cfg = getMomoConfig();
  if (!cfg) throw new Error("PAYMENTS_NOT_CONFIGURED");

  const body = {
    amount: Math.round(args.amount),
    currency: "RWF",
    phone_number: args.phone,
    msisdn: args.phone,
    external_reference: args.externalRef,
    reference: args.externalRef,
    description: args.description,
    ...(cfg.merchantId ? { merchant_id: cfg.merchantId } : {}),
    ...(cfg.callbackUrl ? { callback_url: cfg.callbackUrl } : {}),
  };

  const res = await fetch(`${cfg.baseUrl}${cfg.chargePath}`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: "failed",
      providerRef: readRef(payload),
      message: String(payload.message ?? payload.error ?? `Provider returned ${res.status}`),
      raw: payload,
    };
  }

  return {
    ok: true,
    status: readStatus(payload),
    providerRef: readRef(payload),
    message: payload.message ? String(payload.message) : null,
    raw: payload,
  };
}

/** Ask the provider for the current state of a transaction. */
export async function queryPaymentStatus(ref: string): Promise<ChargeResult | null> {
  const cfg = getMomoConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.baseUrl}${cfg.statusPath}/${encodeURIComponent(ref)}`, {
    headers: authHeaders(cfg),
  });
  const text = await res.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    payload = { raw: text };
  }
  if (!res.ok) return null;
  return {
    ok: true,
    status: readStatus(payload),
    providerRef: readRef(payload) ?? ref,
    message: payload.message ? String(payload.message) : null,
    raw: payload,
  };
}
