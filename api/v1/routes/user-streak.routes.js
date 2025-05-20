import { Router } from "express";
import {
  completeUserTaskUsingTaskId,
  fetchOrgLeaderboardWithRank,
  fetchStreakCalendarForMonth,
  fetchTaskDetailsForDay,
  fetchTheDailyStreakSummary,
  getStreakPopupData,
  markStreakAnimationAsSeen,
} from "../controllers/user-streak.controller.js";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
const router = Router();

router.post(
  "/complete",
  authenticateUserTokenMiddleware,
  completeUserTaskUsingTaskId
);

router.get(
  "/summary",
  authenticateUserTokenMiddleware,
  fetchTheDailyStreakSummary
);

router.get(
  "/monthly-summary",
  authenticateUserTokenMiddleware,
  fetchStreakCalendarForMonth
);

router.get(
  "/day-details",
  authenticateUserTokenMiddleware,
  fetchTaskDetailsForDay
);

router.get(
  "/leaderboard",
  authenticateUserTokenMiddleware,
  fetchOrgLeaderboardWithRank
);

router.get(
  "/streak-status",
  authenticateUserTokenMiddleware,
  getStreakPopupData
);

router.get("/mark-streak-animation", authenticateUserTokenMiddleware, markStreakAnimationAsSeen);

export default router;
