import { Router } from "express";
import * as heroController from "../controller/heroController.js";
import { requirePermission } from "../utils/auth.js";

const router = Router();

router.get("/", heroController.listActive);
router.get("/all", requirePermission("hero"), heroController.listAll);
router.post("/", requirePermission("hero"), heroController.create);
router.patch("/:id", requirePermission("hero"), heroController.update);
router.delete("/:id", requirePermission("hero"), heroController.remove);

export default router;
