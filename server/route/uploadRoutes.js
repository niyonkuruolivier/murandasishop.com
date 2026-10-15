import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { requirePermission } from "../utils/auth.js";
import * as uploadController from "../controller/uploadController.js";
import { uuid } from "../utils/ids.js";
import { extensionForUpload, isAllowedImageFile } from "../utils/imageUpload.js";
import {
  extensionForOrderAttachment,
  isAllowedOrderShippingAttachment,
} from "../utils/attachmentUpload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../public/uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = extensionForUpload(file);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImageFile(file)) return cb(null, true);
    cb(new Error("Only image files are allowed (JPG, PNG, WebP, AVIF, GIF, HEIC, etc.)."));
  },
});

const orderAttachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = extensionForOrderAttachment(file);
    cb(null, `${uuid()}${ext}`);
  },
});

const orderAttachmentUpload = multer({
  storage: orderAttachmentStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedOrderShippingAttachment(file)) return cb(null, true);
    cb(new Error("Upload an image (JPG, PNG, WebP, etc.) or a PDF file."));
  },
});

const router = Router();

router.post("/product-image", requirePermission("products"), upload.single("file"), uploadController.uploadProductImage);
router.post("/product-images", requirePermission("products"), upload.array("files", 12), uploadController.uploadMany);
router.post(
  "/order-shipping-attachment",
  requirePermission("orders"),
  orderAttachmentUpload.single("file"),
  uploadController.uploadOrderShippingAttachment,
);

export default router;
