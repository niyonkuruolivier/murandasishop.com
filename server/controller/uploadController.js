import path from "path";
import { ok, fail } from "../utils/response.js";

export async function uploadProductImage(req, res) {
  try {
    if (!req.file) throw new Error("No file uploaded.");
    const url = `/uploads/${req.file.filename}`;
    return ok(res, { url });
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function uploadMany(req, res) {
  try {
    const files = req.files || [];
    if (!files.length) throw new Error("No files uploaded.");
    return ok(res, { urls: files.map((f) => `/uploads/${f.filename}`) });
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function uploadOrderShippingAttachment(req, res) {
  try {
    if (!req.file) throw new Error("No file uploaded.");
    const url = `/uploads/${req.file.filename}`;
    return ok(res, { url });
  } catch (e) {
    return fail(res, e, 400);
  }
}
