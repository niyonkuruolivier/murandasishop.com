import { Router } from "express";
import * as adminController from "../controller/adminController.js";
import * as settingsController from "../controller/settingsController.js";
import { requireAdmin } from "../utils/auth.js";

const router = Router();

router.get("/badges", requireAdmin, adminController.badges);
router.get("/settings/contact", requireAdmin, settingsController.getShopSettings);
router.patch("/settings/contact", requireAdmin, settingsController.updateWhatsApp);

export default router;
