import { api, apiUrl, uploadApiUrl } from "@/lib/api";
import { logClientError } from "@/lib/debug";
import { isAllowedProductImage } from "@/lib/image-formats";

function absolutize(url: string | null | undefined): string {
  const value = String(url ?? "").trim();
  if (!value) throw new Error("Upload succeeded but the server did not return an image URL.");
  if (value.startsWith("http")) return value;
  return apiUrl(value);
}

function extractUploadUrl(data: unknown): string | undefined {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return undefined;

  const row = data as Record<string, unknown>;
  if (typeof row.url === "string") return row.url;
  if (typeof row.path === "string") return row.path;

  if (row.data && typeof row.data === "object") {
    const inner = row.data as Record<string, unknown>;
    if (typeof inner.url === "string") return inner.url;
    if (typeof inner.path === "string") return inner.path;
  }

  return undefined;
}

function extractUploadUrls(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const row = data as Record<string, unknown>;

  if (Array.isArray(row.urls)) {
    return row.urls.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  }

  if (row.data && typeof row.data === "object") {
    const inner = row.data as Record<string, unknown>;
    if (Array.isArray(inner.urls)) {
      return inner.urls.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
    }
  }

  const single = extractUploadUrl(data);
  return single ? [single] : [];
}

function assertImageFile(file: File) {
  if (!isAllowedProductImage(file)) {
    throw new Error("Please choose an image file (JPG, PNG, WebP, AVIF, GIF, SVG, HEIC, etc.).");
  }
}

function logUploadFailure(kind: string, endpoint: string, error: unknown, response?: unknown) {
  logClientError(`Upload ${kind}`, error, { endpoint, response });
}

export async function uploadProductImage(file: File): Promise<string> {
  assertImageFile(file);
  const endpoint = uploadApiUrl("product-image");
  const body = new FormData();
  body.append("file", file);

  try {
    const data = await api<unknown>("/uploads/product-image", {
      method: "POST",
      body,
      url: endpoint,
    });
    const url = extractUploadUrl(data);
    if (!url) {
      const err = new Error("Upload succeeded but the server did not return an image URL.");
      logUploadFailure("product-image", endpoint, err, data);
      throw err;
    }
    const absolute = absolutize(url);
    console.info("[Murandasi] Upload OK", { kind: "product-image", endpoint, url: absolute });
    return absolute;
  } catch (error) {
    logUploadFailure("product-image", endpoint, error);
    throw error;
  }
}

export async function uploadProductImages(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files);
  list.forEach(assertImageFile);
  const endpoint = uploadApiUrl("product-images");
  const body = new FormData();
  list.forEach((f) => body.append("files", f));

  try {
    const data = await api<unknown>("/uploads/product-images", {
      method: "POST",
      body,
      url: endpoint,
    });
    const urls = extractUploadUrls(data);
    if (!urls.length) {
      const err = new Error("Upload succeeded but the server did not return image URLs.");
      logUploadFailure("product-images", endpoint, err, data);
      throw err;
    }
    const absolute = urls.map((u) => absolutize(u));
    console.info("[Murandasi] Upload OK", {
      kind: "product-images",
      endpoint,
      count: absolute.length,
      urls: absolute,
    });
    return absolute;
  } catch (error) {
    logUploadFailure("product-images", endpoint, error);
    throw error;
  }
}

/** Local upload path for WhatsApp proofs (kept for compatibility). */
export async function uploadWhatsappProof(file: File): Promise<string> {
  return uploadProductImage(file);
}

export async function signWhatsappProof(path: string): Promise<string> {
  return absolutize(path);
}

function isAllowedShippingAttachment(file: File): boolean {
  const type = String(file.type || "").toLowerCase();
  if (type === "application/pdf") return true;
  return isAllowedProductImage(file);
}

/** Upload proof for shipped orders — returns path like /uploads/….pdf for the API. */
export async function uploadOrderShippingAttachment(file: File): Promise<string> {
  if (!isAllowedShippingAttachment(file)) {
    throw new Error("Choose an image (JPG, PNG, WebP, etc.) or a PDF file.");
  }
  const endpoint = uploadApiUrl("order-shipping-attachment");
  const body = new FormData();
  body.append("file", file);

  try {
    const data = await api<unknown>("/uploads/order-shipping-attachment", {
      method: "POST",
      body,
      url: endpoint,
    });
    const url = extractUploadUrl(data);
    if (!url) {
      throw new Error("Upload succeeded but the server did not return a file URL.");
    }
    return url.startsWith("/") ? url : `/${url}`;
  } catch (error) {
    logUploadFailure("order-shipping-attachment", endpoint, error);
    throw error;
  }
}
