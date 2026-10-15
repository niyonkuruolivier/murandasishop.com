import { Router } from "express";
import * as locationController from "../controller/locationController.js";
import { requireAuth } from "../utils/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", locationController.list);
router.post("/", locationController.create);
router.delete("/:id", locationController.remove);
router.patch("/:id/default", locationController.makeDefault);

export default router;
