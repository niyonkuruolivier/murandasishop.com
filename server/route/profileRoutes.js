import { Router } from "express";
import * as profileController from "../controller/profileController.js";
import { requireAuth, requirePermission } from "../utils/auth.js";

const router = Router();

router.get("/me", requireAuth, profileController.me);
router.get("/purchased-slugs", requireAuth, profileController.purchasedSlugs);
router.get("/is-admin", requireAuth, profileController.isAdmin);
router.get("/notifications", requireAuth, profileController.notifications);
router.patch("/notifications/read", requireAuth, profileController.markNotificationsRead);
router.get("/whatsapp", requireAuth, profileController.whatsapp);
router.get("/list", requirePermission("users"), profileController.listProfiles);

export default router;
