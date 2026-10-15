import { logClientError } from "@/lib/debug";

const TOKEN_KEY = "murandasi_token";

function isLocalApiUrl(url: string) {
  return !url || url.includes("localhost") || url.includes("127.0.0.1");
}

/** Ensure every API base ends with `/api` (fixes VITE_API_URL missing the suffix). */
function normalizeApiBase(base: string): string {
  const trimmed = (base || "").trim().replace(/\/$/, "");
  if (!trimmed) return "/api";
  if (trimmed.endsWith("/api")) return trimmed;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return `${trimmed}/api`;
  }

  if (trimmed.startsWith("/")) {
    return trimmed === "/" ? "/api" : `${trimmed}/api`.replace(/\/{2,}/g, "/");
  }

  return `${trimmed}/api`;
}

/** Pick API base at runtime — supports local API, hosted API from dev, and production. */
export function getApiBase(): string {
  const env = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

  if (typeof window === "undefined") {
    return normalizeApiBase(env || "http://localhost:4000/api");
  }

  const { origin, hostname, port } = window.location;
  const onLocalDev = hostname === "localhost" || hostname === "127.0.0.1";

  // Live site — same-origin /api via Passenger.
  if (!onLocalDev) {
    return normalizeApiBase(`${origin}/api`);
  }

  // Local dev + hosted API in .env (e.g. https://murandasishop.com/api).
  if (!isLocalApiUrl(env)) {
    return normalizeApiBase(env);
  }

  // Local dev + local API on Vite (8080) — proxy /api → localhost:4000.
  if (port && port !== "4000") {
    return normalizeApiBase(env || "/api");
  }

  return normalizeApiBase(env || "http://localhost:4000/api");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function siteOriginFromApiBase(base: string): string {
  const safe = base || "";
  if (safe.startsWith("http")) return safe.replace(/\/api\/?$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Absolute URL for product image upload POST (always under /api/uploads/… on cPanel). */
export type UploadApiKind = "product-image" | "product-images" | "order-shipping-attachment";

export function uploadApiUrl(kind: UploadApiKind): string {
  const base = getApiBase().replace(/\/$/, "");
  return `${base}/uploads/${kind}`;
}

/** Public URL for a file stored under /uploads/… */
export function publicUploadUrl(path: string | null | undefined): string | null {
  const value = String(path ?? "").trim();
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return apiUrl(value.startsWith("/") ? value : `/${value}`);
}

export function apiUrl(path: string) {
  if (!path) throw new Error("Missing API path.");
  if (path.startsWith("http")) return path;

  const base = getApiBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;

  // Static uploaded files — served at /uploads/… (not /api/uploads/…).
  if (normalized.startsWith("/uploads/")) {
    if (base.startsWith("http")) {
      return `${siteOriginFromApiBase(base)}${normalized}`;
    }
    return normalized;
  }

  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${prefix}${normalized}`;
}

function parseApiBody(text: string, contentType: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const looksHtml =
    trimmed.startsWith("<!") ||
    trimmed.startsWith("<html") ||
    (!contentType.includes("json") && trimmed.startsWith("<"));

  if (looksHtml) {
    throw new ApiError(
      "Server returned a web page instead of JSON. Upload/API may be misconfigured — use /api/uploads/… on the server.",
      502,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) };
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean; url?: string } = {},
): Promise<T> {
  const { auth = true, headers: initHeaders, url: absoluteUrl, ...rest } = options;
  const headers = new Headers(initHeaders);
  const target = absoluteUrl ?? apiUrl(path);

  if (!headers.has("Content-Type") && rest.body && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (auth !== false) {
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(target, { ...rest, headers });
  } catch (networkError) {
    logClientError("API network error", networkError, {
      method: rest.method ?? "GET",
      target,
      path,
    });
    throw new ApiError(
      `Cannot reach the server (${target}). Check that Node is running on the server.`,
      0,
    );
  }

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  let data: unknown;

  try {
    data = parseApiBody(text, contentType);
  } catch (e) {
    if (e instanceof ApiError) {
      logClientError("API bad response", e, {
        method: rest.method ?? "GET",
        target,
        status: res.status,
        contentType,
        bodyPreview: text.slice(0, 300),
      });
      throw e;
    }
    data = { error: text.slice(0, 200) };
  }

  if (!res.ok) {
    if (res.status === 401 && auth !== false) {
      setStoredToken(null);
    }
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    logClientError("API HTTP error", new Error(message), {
      method: rest.method ?? "GET",
      target,
      status: res.status,
      response: data,
    });
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export const apiGet = <T>(path: string, auth = true) => api<T>(path, { method: "GET", auth });

export const apiPost = <T>(path: string, body?: unknown, auth = true) =>
  api<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    auth,
  });

export const apiPatch = <T>(path: string, body?: unknown, auth = true) =>
  api<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    auth,
  });

export const apiDelete = <T>(path: string, auth = true) => api<T>(path, { method: "DELETE", auth });
