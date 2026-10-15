import { Router } from "express";
import * as productController from "../controller/productController.js";
import { requirePermission } from "../utils/auth.js";

const router = Router();

router.get("/", productController.list);
router.get("/admin", requirePermission("products"), productController.listAdmin);
router.get("/:slug", productController.getBySlug);
router.post("/", requirePermission("products"), productController.create);
router.patch("/:id", requirePermission("products"), productController.update);
router.delete("/:id", requirePermission("products"), productController.remove);

export default router;
