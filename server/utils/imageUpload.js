import path from "path";

/** Common product image extensions (case-insensitive). */
export const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".jpe",
  ".jfif",
  ".pjpeg",
  ".pjp",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".svgz",
  ".bmp",
  ".tif",
  ".tiff",
  ".ico",
  ".heic",
  ".heif",
  ".apng",
]);

const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/x-ms-bmp": ".bmp",
  "image/tiff": ".tiff",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/apng": ".png",
};

export function isAllowedImageFile(file) {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export function extensionForUpload(file) {
  const fromName = path.extname(String(file?.originalname || "")).toLowerCase();
  if (fromName && IMAGE_EXTENSIONS.has(fromName)) return fromName;
  const mime = String(file?.mimetype || "").toLowerCase();
  if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];
  return fromName || ".jpg";
}
