import { Router } from "express";
import * as userAdminController from "../controller/userAdminController.js";
import { requireAnyPermission, requirePermission } from "../utils/auth.js";

const router = Router();

router.get("/permissions/catalog", requirePermission("staff"), userAdminController.permissionCatalog);
router.post("/staff", requirePermission("staff"), userAdminController.createStaff);
router.patch("/:id/permissions", requirePermission("staff"), userAdminController.updatePermissions);
router.get("/", requireAnyPermission("users", "staff"), userAdminController.listUsers);
router.patch("/:id/blocked", requirePermission("users"), userAdminController.setBlocked);
router.delete("/:id", requirePermission("users"), userAdminController.removeUser);

export default router;
