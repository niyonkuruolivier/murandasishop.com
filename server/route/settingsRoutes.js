import { Router } from "express";
import * as settingsController from "../controller/settingsController.js";

const router = Router();

router.get("/contact", settingsController.publicContact);

export default router;
