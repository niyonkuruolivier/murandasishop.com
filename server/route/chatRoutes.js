import { Router } from "express";
import * as chatController from "../controller/chatController.js";

const router = Router();

router.post("/", chatController.chat);

export default router;
