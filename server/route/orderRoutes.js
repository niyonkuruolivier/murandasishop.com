import { Router } from "express";
import * as orderController from "../controller/orderController.js";
import { optionalAuth, requireAuth, requirePermission } from "../utils/auth.js";

const router = Router();

router.post("/checkout", optionalAuth, orderController.checkout);
router.get("/me", requireAuth, orderController.mine);
router.post("/:id/confirm-delivery", requireAuth, orderController.confirmDelivery);
router.get("/pending-count", requirePermission("orders"), orderController.pendingCount);
router.get("/", requirePermission("orders"), orderController.listAll);
router.patch("/:id/status", requirePermission("orders"), orderController.updateStatus);

export default router;
