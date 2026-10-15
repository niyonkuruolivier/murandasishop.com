import { Router } from "express";
import * as walletController from "../controller/walletController.js";
import { requireAuth, requirePermission } from "../utils/auth.js";

const router = Router();

router.get("/balance", requireAuth, walletController.balance);
router.get("/transactions", requireAuth, walletController.transactions);
router.get("/cashback-policy", walletController.cashbackPolicy);
router.post("/redeem", requireAuth, walletController.redeem);
router.get("/admin", requirePermission("cashback"), walletController.listWallets);
router.get("/admin/settings", requirePermission("cashback"), walletController.getCashbackSettings);
router.patch("/admin/settings", requirePermission("cashback"), walletController.updateCashbackSettings);
router.get("/admin/:userId/transactions", requirePermission("cashback"), walletController.transactionsForUser);
router.post("/admin/adjust", requirePermission("cashback"), walletController.adjust);
router.post("/admin/reverse-cashback", requirePermission("cashback"), walletController.reverseCashback);

export default router;
