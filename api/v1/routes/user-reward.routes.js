import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  awardXPForTask,
  getWeeklyStreakSummary,
  getMonthlySummary,
  getDayStreakBreakup,
  getStreakStatus,
  markAnimationSeen,
  dailyLogin,
} from "../controllers/user-reward.controller.js";

const router = Router();

router.post("/award-xp", authenticateUserTokenMiddleware, awardXPForTask);
router.get("/weekly-streak-summary", authenticateUserTokenMiddleware, getWeeklyStreakSummary);
router.get("/monthly-summary", authenticateUserTokenMiddleware, getMonthlySummary);
router.get("/day-streak-breakup", authenticateUserTokenMiddleware, getDayStreakBreakup);
router.get("/streak-status", authenticateUserTokenMiddleware, getStreakStatus);
router.post("/mark-animation-seen", authenticateUserTokenMiddleware, markAnimationSeen);
router.post("/daily-login", authenticateUserTokenMiddleware, dailyLogin);

export default router;
