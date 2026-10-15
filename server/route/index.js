import { Router } from "express";
import productRoutes from "./productRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import heroRoutes from "./heroRoutes.js";
import orderRoutes from "./orderRoutes.js";
import walletRoutes from "./walletRoutes.js";
import profileRoutes from "./profileRoutes.js";
import referralRoutes from "./referralRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import chatRoutes from "./chatRoutes.js";
import userAdminRoutes from "./userAdminRoutes.js";
import locationRoutes from "./locationRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import { health } from "../controller/healthController.js";

const router = Router();

router.get("/health", health);
router.use("/settings", settingsRoutes);
router.use("/chat", chatRoutes);
router.use("/auth", authRoutes);
router.use("/users", userAdminRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/hero-slides", heroRoutes);
router.use("/orders", orderRoutes);
router.use("/wallet", walletRoutes);
router.use("/locations", locationRoutes);
router.use("/profile", profileRoutes);
router.use("/referrals", referralRoutes);
router.use("/payments", paymentRoutes);
router.use("/admin", adminRoutes);
router.use("/uploads", uploadRoutes);

export default router;
