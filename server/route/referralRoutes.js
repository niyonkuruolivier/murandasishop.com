import { Router } from "express";
import * as referralController from "../controller/referralController.js";
import { requireAuth } from "../utils/auth.js";

const router = Router();

router.post("/claim", requireAuth, referralController.claim);
router.get("/stats", requireAuth, referralController.stats);
router.get("/", requireAuth, referralController.list);

export default router;
