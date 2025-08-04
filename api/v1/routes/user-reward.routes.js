import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import { awardXPForTask } from "../controllers/user-reward.controller.js";

const router = Router();

router.post("/award-xp", authenticateUserTokenMiddleware, awardXPForTask);

export default router;
