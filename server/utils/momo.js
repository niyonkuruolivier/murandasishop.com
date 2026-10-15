export function getMomoConfig() {
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

function authHeaders(cfg) {
  const h = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.apiSecret) h["X-API-Secret"] = cfg.apiSecret;
  if (cfg.merchantId) h["X-Merchant-Id"] = cfg.merchantId;
  return h;
}

export function normalizeStatus(value) {
  const s = String(value ?? "").toLowerCase();
  if (["success", "successful", "succeeded", "completed", "paid", "accepted"].includes(s))
    return "success";
  if (
    ["failed", "failure", "rejected", "cancelled", "canceled", "declined", "expired", "timeout"].includes(
      s,
    )
  )
    return "failed";
  return "pending";
}

function readStatus(payload) {
  const candidate =
    payload.status ??
    payload.state ??
    payload.transaction_status ??
    payload.data?.status;
  return normalizeStatus(candidate);
}

function readRef(payload) {
  const data = payload.data ?? {};
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

export async function requestToPay({ amount, phone, externalRef, description }) {
  const cfg = getMomoConfig();
  if (!cfg) throw new Error("PAYMENTS_NOT_CONFIGURED");

  const body = {
    amount: Math.round(amount),
    currency: "RWF",
    phone_number: phone,
    msisdn: phone,
    external_reference: externalRef,
    reference: externalRef,
    description,
    ...(cfg.merchantId ? { merchant_id: cfg.merchantId } : {}),
    ...(cfg.callbackUrl ? { callback_url: cfg.callbackUrl } : {}),
  };

  const res = await fetch(`${cfg.baseUrl}${cfg.chargePath}`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
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

export async function queryPaymentStatus(ref) {
  const cfg = getMomoConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.baseUrl}${cfg.statusPath}/${encodeURIComponent(ref)}`, {
    headers: authHeaders(cfg),
  });
  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
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
