import { Router } from "express";
import * as paymentController from "../controller/paymentController.js";
import { requirePermission } from "../utils/auth.js";

const router = Router();

router.post("/momo", paymentController.initiate);
router.post("/intouchpay", paymentController.initiate);
// Docs-style + app path — both must be whitelisted by IntouchPay before live
router.post("/intouchpay/callback", paymentController.intouchCallback);
router.post("/intouch/callback", paymentController.intouchCallback);
router.get("/intouchpay/config", requirePermission("payments"), paymentController.intouchConfig);
router.get("/intouchpay/balance", requirePermission("payments"), paymentController.intouchBalance);
router.post("/intouchpay/deposit", requirePermission("payments"), paymentController.intouchDeposit);
router.get("/intouchpay/deposits", requirePermission("payments"), paymentController.intouchDeposits);
router.post("/status", paymentController.status);
router.get("/status/:id", paymentController.status);
router.get("/", requirePermission("payments"), paymentController.listAll);
router.patch("/:id/status", requirePermission("payments"), paymentController.updateStatus);
router.delete("/history", requirePermission("payments"), paymentController.clearHistory);
router.delete("/:id", requirePermission("payments"), paymentController.remove);

export default router;
