import { Router } from "express";
import * as authController from "../controller/authController.js";
import { requireAuth } from "../utils/auth.js";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/google", authController.google);
router.get("/me", requireAuth, authController.me);

export default router;
