import { Router } from "express";
import * as categoryController from "../controller/categoryController.js";
import { requirePermission } from "../utils/auth.js";

const router = Router();

router.get("/", categoryController.list);
router.post("/", requirePermission("categories"), categoryController.create);
router.patch("/:slug", requirePermission("categories"), categoryController.update);
router.delete("/:slug", requirePermission("categories"), categoryController.remove);

export default router;
