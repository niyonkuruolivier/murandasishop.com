import path from "path";
import { extensionForUpload, isAllowedImageFile } from "./imageUpload.js";

export function isAllowedOrderShippingAttachment(file) {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime === "application/pdf") return true;
  if (isAllowedImageFile(file)) return true;
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();
  return ext === ".pdf";
}

export function extensionForOrderAttachment(file) {
  const fromName = path.extname(String(file?.originalname || "")).toLowerCase();
  if (fromName === ".pdf") return ".pdf";
  return extensionForUpload(file);
}
