import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { rootDir } from "../loadEnv.js";

/** Our own webhook path. Must stay in sync with server/route/paymentRoutes.js. */
export const CALLBACK_PATH = "/api/payments/intouchpay/callback";

/** Written by `npm run tunnel` so local dev can receive real callbacks. */
const TUNNEL_FILE = path.join(rootDir, ".tunnel-url");

// IntouchPay production account. Keep this file private and never commit or
// expose it to the browser. Keep the credentials in this server-only module.
export const INTOUCHPAY_USERNAME = "murandasi";
export const INTOUCHPAY_ACCOUNT_NO = "250260008897";
export const INTOUCHPAY_PARTNER_PASSWORD = "QwE)3FM~H]'dwqxiR(XXv<NZ$iTfK,-Jams2Si<7";
export const INTOUCHPAY_MODE = "live";
export const INTOUCHPAY_BASE_URL = "https://www.intouchpay.co.rw";
export const INTOUCHPAY_CALLBACK_URL =
  "https://murandasishop.com/api/payments/intouchpay/callback";

/**
 * Sandbox (developer portal):
 *   https://developer.intouchpay.co.rw/api/v1/sandbox/*
 * Live:
 *   https://www.intouchpay.co.rw/api/*
 */
function cfg() {
  // These production credentials intentionally come from this server-only
  // module. This prevents stale cPanel environment variables from overriding
  // the credentials that were verified with IntouchPay.
  const username = INTOUCHPAY_USERNAME;
  const partnerPassword = INTOUCHPAY_PARTNER_PASSWORD;
  const accountNo = INTOUCHPAY_ACCOUNT_NO;
  if (!username || !partnerPassword || !accountNo) return null;

  const mode = INTOUCHPAY_MODE;
  const sandbox = mode !== "live";

  const defaultBase = sandbox
    ? "https://developer.intouchpay.co.rw"
    : "https://www.intouchpay.co.rw";

  return {
    sandbox,
    baseUrl: (INTOUCHPAY_BASE_URL || defaultBase).replace(/\/+$/, ""),
    username,
    partnerPassword,
    accountNo,
    callbackUrl: process.env.INTOUCHPAY_CALLBACK_URL || INTOUCHPAY_CALLBACK_URL,
  };
}

function endpoint(c, name) {
  // name: getbalance | requestpayment | requestdeposit | gettransactionstatus
  if (c.sandbox) return `${c.baseUrl}/api/v1/sandbox/${name}/`;
  return `${c.baseUrl}/api/${name}/`;
}

export function isIntouchPayConfigured() {
  return Boolean(cfg());
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

function generatePassword(c, ts) {
  return createHash("sha256")
    .update(`${c.username}${c.accountNo}${c.partnerPassword}${ts}`)
    .digest("hex");
}

/** Normalize to IntouchPay mobilephone: 25XXXXXXXXXX */
export function formatMobilePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("250") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `25${digits}`;
  if (digits.length === 9) return `250${digits}`;
  if (digits.startsWith("25")) return digits;
  return `25${digits}`;
}

export function makeRequestTransactionId() {
  return `PAY_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
}

export function normalizeIntouchStatus(responseCode, status) {
  const code = String(responseCode ?? "").trim();
  const s = String(status ?? "")
    .trim()
    .toUpperCase();
  // Docs + sandbox variants: successful / Successfull / SUCCESSFUL / 01
  if (
    s === "SUCCESSFUL" ||
    s === "SUCCESSFULL" ||
    s === "SUCCESS" ||
    s === "COMPLETED" ||
    s === "PAID"
  ) {
    return "success";
  }
  if (code === "01") return "success";
  if (code === "1000" || code === "2001" || s === "PENDING") return "pending";
  if (!code && !s) return "pending";
  if (s === "FAILED" || s === "FAILURE" || s === "DECLINED" || s === "TIMEOUT" || s === "EXPIRED") {
    return "failed";
  }
  return "failed";
}

/** Exact ack IntouchPay docs require after every callback. */
export function callbackAck(requestId) {
  return {
    message: "success",
    success: "True",
    request_id: requestId || "",
  };
}

async function parseResponse(res) {
  const text = await res.text();
  if (/<!DOCTYPE|<html|Bot Verification|robots/i.test(text)) {
    return {
      success: false,
      responsecode: "5008",
      message:
        "IntouchPay bot protection triggered. Whitelist your server IP or disable bot protection for API endpoints.",
      raw: { preview: text.slice(0, 200) },
    };
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      responsecode: "5006",
      message: "Invalid JSON response from IntouchPay",
      raw: { preview: text.slice(0, 200) },
    };
  }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await parseResponse(res);
  return { res, json };
}

function isPrivateHost(host) {
  const h = String(host || "").toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.endsWith(".local") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  );
}

function isPublicHttpUrl(value) {
  if (!value) return false;
  try {
    const u = new URL(String(value).trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return !isPrivateHost(u.hostname);
  } catch {
    return false;
  }
}

function joinUrl(base, urlPath) {
  if (!base) return null;
  return `${String(base).trim().replace(/\/+$/, "")}${urlPath}`;
}

/** Public base URL published by `npm run tunnel` (dev only). */
function readTunnelBase() {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const value = fs.readFileSync(TUNNEL_FILE, "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Where IntouchPay should POST the final status.
 *
 * Must always be OUR OWN public endpoint: IntouchPay retries 4-5 times whenever
 * the callback is not acknowledged, so pointing it anywhere else (or at
 * localhost) guarantees repeated deliveries and connect timeouts on their side.
 */
export function getCallbackTarget() {
  const tunnel = joinUrl(readTunnelBase(), CALLBACK_PATH);
  const publicBase = joinUrl(process.env.INTOUCHPAY_PUBLIC_BASE_URL, CALLBACK_PATH);
  const configured = process.env.INTOUCHPAY_CALLBACK_URL || INTOUCHPAY_CALLBACK_URL;
  const configuredSource = process.env.INTOUCHPAY_CALLBACK_URL
    ? "INTOUCHPAY_CALLBACK_URL"
    : "built-in callback";

  const candidates = [
    { url: tunnel, source: "tunnel (.tunnel-url)" },
    { url: publicBase, source: "INTOUCHPAY_PUBLIC_BASE_URL" },
    { url: configured, source: configuredSource },
  ];

  for (const candidate of candidates) {
    if (isPublicHttpUrl(candidate.url)) return { ...candidate, ok: true };
  }

  const rejected = candidates.find((candidate) => candidate.url);
  return {
    ok: false,
    url: null,
    source: rejected?.source ?? null,
    rejected: rejected?.url ?? null,
  };
}

function resolveCallbackUrl() {
  const target = getCallbackTarget();
  if (target.ok) {
    console.log(`[IntouchPay] callbackurl ← ${target.source}: ${target.url}`);
    return target.url;
  }

  if (String(process.env.INTOUCHPAY_ALLOW_NO_CALLBACK).toLowerCase() === "true") {
    console.warn(
      "[IntouchPay] No public callbackurl — sending request without one (status polling only).",
    );
    return null;
  }

  const detail = target.rejected
    ? `"${target.rejected}" is not publicly reachable`
    : "no callback URL is configured";

  throw new Error(
    `IntouchPay callback URL is unusable: ${detail}. ` +
      "IntouchPay must reach your server or it will retry the callback 4-5 times. " +
      "Run `npm run tunnel` for local testing, or set INTOUCHPAY_PUBLIC_BASE_URL / INTOUCHPAY_CALLBACK_URL to a public HTTPS URL.",
  );
}

function formatApiMessage(message) {
  if (message == null) return null;
  if (typeof message === "string") return message;
  if (typeof message === "object") {
    try {
      return Object.entries(message)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
        .join("; ");
    } catch {
      return JSON.stringify(message);
    }
  }
  return String(message);
}

/** Collect money — sandbox: /api/v1/sandbox/requestpayment/ */
export async function requestPayment({ phone, amount, requestTransactionId }) {
  const c = cfg();
  if (!c) throw new Error("INTOUCHPAY_NOT_CONFIGURED");

  const ts = timestamp();
  const password = generatePassword(c, ts);
  const mobilephone = formatMobilePhone(phone);
  const url = endpoint(c, "requestpayment");
  const callbackurl = resolveCallbackUrl();

  const body = {
    username: c.username,
    timestamp: ts,
    amount: Math.round(amount),
    password,
    mobilephone,
    requesttransactionid: requestTransactionId,
    accountno: c.accountNo,
    ...(callbackurl ? { callbackurl } : {}),
  };

  console.log("[IntouchPay] requestPayment", {
    url,
    requestTransactionId,
    amount: body.amount,
    mobilephone,
    callbackurl,
  });

  let json;
  let res;
  if (c.sandbox) {
    ({ res, json } = await postJson(url, body));
  } else {
    // Live docs also accept form-urlencoded for requestpayment
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(
        Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])),
      ).toString(),
    });
    json = await parseResponse(res);
  }

  const apiMessage = formatApiMessage(json.message) || formatApiMessage(json.detail) || formatApiMessage(json.error);

  console.log("[IntouchPay] requestPayment response", {
    http: res.status,
    success: json.success,
    status: json.status,
    responsecode: json.responsecode,
    message: apiMessage,
    transactionid: json.transactionid,
    raw: json,
  });

  const ok =
    res.status >= 200 &&
    res.status < 300 &&
    (Boolean(json.success) ||
      String(json.status || "").toLowerCase() === "success" ||
      String(json.status || "").toLowerCase() === "pending" ||
      ["2001", "1000", "01"].includes(String(json.responsecode || "")));

  const providerRef = json.referenceid ?? json.transactionid ?? json.id ?? null;
  let status = ok
    ? normalizeIntouchStatus(json.responsecode ?? "2001", json.status ?? "PENDING")
    : "failed";
  if (ok && status === "failed") status = "pending";

  return {
    ok,
    status,
    requestTransactionId: json.requesttransactionid ?? requestTransactionId,
    providerRef: providerRef ? String(providerRef) : null,
    message: apiMessage || (ok ? "Payment prompt sent. Approve on your phone if asked." : "IntouchPay request failed."),
    responseCode: json.responsecode ?? null,
    raw: json,
  };
}

/** Poll status — sandbox: /api/v1/sandbox/gettransactionstatus/ */
export async function getTransactionStatus(requestTransactionId, transactionId) {
  const c = cfg();
  if (!c || !requestTransactionId || !transactionId) return null;

  const ts = timestamp();
  const password = generatePassword(c, ts);
  const url = endpoint(c, "gettransactionstatus");
  const body = {
    username: c.username,
    timestamp: ts,
    password,
    requesttransactionid: requestTransactionId,
    transactionid: String(transactionId),
    accountno: c.accountNo,
  };

  const { json } = await postJson(url, body);
  if (!json || json.responsecode === "5008" || json.responsecode === "5006") {
    return { ok: false, status: "pending", message: json.message, raw: json };
  }

  const status = normalizeIntouchStatus(json.responsecode, json.status ?? json.transaction_status);
  return {
    ok: Boolean(json.success ?? true),
    status,
    message: json.message ? String(json.message) : null,
    responseCode: json.responsecode ?? null,
    providerRef: json.transactionid ? String(json.transactionid) : String(transactionId),
    raw: json,
  };
}

/** Send money — sandbox: /api/v1/sandbox/requestdeposit/ */
export async function requestDeposit({ phone, amount, requestTransactionId, reason = "Payout" }) {
  const c = cfg();
  if (!c) throw new Error("INTOUCHPAY_NOT_CONFIGURED");

  const ts = timestamp();
  const password = generatePassword(c, ts);
  const mobilephone = formatMobilePhone(phone);
  const url = endpoint(c, "requestdeposit");

  const body = {
    username: c.username,
    timestamp: ts,
    amount: Math.round(amount),
    withdrawcharge: 1,
    reason,
    sid: "1",
    mobilephone,
    requesttransactionid: requestTransactionId,
    password,
    accountno: c.accountNo,
  };

  console.log("[IntouchPay] requestDeposit", { url, requestTransactionId, amount: body.amount, mobilephone });

  const { res, json } = await postJson(url, body);
  const ok =
    res.status >= 200 &&
    res.status < 300 &&
    (Boolean(json.success) || String(json.status || "").toLowerCase() === "success");

  return {
    ok,
    status: ok ? normalizeIntouchStatus(json.responsecode ?? "01", json.status ?? "PENDING") : "failed",
    requestTransactionId: json.requesttransactionid ?? requestTransactionId,
    providerRef: json.transactionid ?? json.referenceid ?? json.id ?? null,
    message: json.message
      ? String(json.message)
      : ok
        ? "Deposit requested."
        : String(json.detail || json.error || "Deposit request failed."),
    responseCode: json.responsecode ?? null,
    raw: json,
  };
}

const BALANCE_ERRORS = {
  "0002": "Missing Username Information",
  "0003": "Missing Password Information",
  "0004": "Missing Date Information",
  "0005": "Invalid Password",
  "0006": "User does not have an IntouchPay account",
  "0007": "No such user — check INTOUCHPAY_USERNAME in .env",
  "0008": "Failed to Authenticate",
};

function explainProviderError(message) {
  const text = message == null ? "" : String(message);
  if (/IP .*not allowed/i.test(text)) {
    return `${text}. Ask IntouchPay to whitelist the public IP address shown in this message, then restart the API.`;
  }
  return text;
}

/** Sandbox: POST https://developer.intouchpay.co.rw/api/v1/sandbox/getbalance/ */
export async function getBalance() {
  const c = cfg();
  if (!c) throw new Error("INTOUCHPAY_NOT_CONFIGURED");

  const ts = timestamp();
  const password = generatePassword(c, ts);
  const url = endpoint(c, "getbalance");
  const body = {
    username: c.username,
    accountno: c.accountNo,
    timestamp: ts,
    password,
  };

  console.log("[IntouchPay] getBalance", { url, username: c.username, accountno: c.accountNo, timestamp: ts });

  const { res, json } = await postJson(url, body);
  const code = String(json.responsecode ?? json.code ?? "");
  console.log("[IntouchPay] getBalance response", {
    httpStatus: res.status,
    responseCode: code || null,
    raw: json,
  });
  const balance =
    json.balance ??
    json.accountbalance ??
    json.AccountBalance ??
    json.Amount ??
    json.amount ??
    json.data?.balance ??
    null;

  const statusOk =
    String(json.status || "").toLowerCase() === "success" ||
    json.success === true ||
    (balance != null && res.status >= 200 && res.status < 300);

  let message =
    json.message ||
    (BALANCE_ERRORS[code] ? BALANCE_ERRORS[code] : null) ||
    (typeof json.detail === "string" ? json.detail : null) ||
    json.error ||
    null;
  message = explainProviderError(message);

  if (!statusOk && !message) {
    message = `IntouchPay response: ${JSON.stringify(json).slice(0, 200)}`;
  }

  return {
    ok: Boolean(statusOk && balance != null),
    balance: balance != null ? Number(balance) : null,
    currency: json.currency || "RWF",
    message: message ? String(message) : null,
    responseCode: code || null,
    accountNo: c.accountNo,
    username: c.username,
    mode: c.sandbox ? "sandbox" : "live",
    endpoint: url,
    timestamp: ts,
    httpStatus: res.status,
    raw: json,
  };
}

/** Parse IntouchPay callback body (JSON / jsonpayload / form / query string). */
export function parseCallbackPayload(req) {
  let data = null;
  let raw = req.body;

  if (typeof raw === "string" && raw.trim()) {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = Object.fromEntries(new URLSearchParams(raw));
    }
  }

  // Fall back to the query string if the body arrived empty.
  if ((!raw || (typeof raw === "object" && Object.keys(raw).length === 0)) && req.query) {
    raw = req.query;
  }

  if (raw && typeof raw === "object") {
    if (raw.jsonpayload) {
      try {
        data = typeof raw.jsonpayload === "string" ? JSON.parse(raw.jsonpayload) : raw.jsonpayload;
      } catch {
        data = raw;
      }
    } else {
      data = raw;
    }
  }

  if (!data || typeof data !== "object") return null;

  // Docs example: { requesttransactionid, status: 'successful', ... }
  const requestTransactionId =
    data.requesttransactionid ??
    data.requestTransactionId ??
    data.request_transaction_id ??
    data.request_id ??
    null;

  let transactionId =
    data.transactionid ??
    data.transactionId ??
    data.referenceno ??
    data.referenceid ??
    data.referenceId ??
    null;
  if (transactionId != null) transactionId = String(transactionId);

  const responseCode = data.responsecode ?? data.responseCode ?? data.response_code ?? null;
  const status = data.status ?? null;
  const statusDesc = data.statusdesc ?? data.statusDesc ?? data.satausdesc ?? data.message ?? null;

  return {
    requestTransactionId: requestTransactionId != null ? String(requestTransactionId) : null,
    transactionId,
    responseCode,
    status,
    statusDesc,
    raw: data,
  };
}
