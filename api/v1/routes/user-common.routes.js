import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  fetchUserSelectedRoadmaps,
  getAllUserNotifications,
  markNotificationsAsSeen,
  setUserRoadmap,
  userConfigController,
} from "../controllers/user-common.controller.js";
import UserStreaksRoutes from "./user-streak.routes.js";

const router = Router();

router.use("/streaks", authenticateUserTokenMiddleware, UserStreaksRoutes);

router.use("/config", authenticateUserTokenMiddleware, userConfigController);

router.post("/set-roadmap", authenticateUserTokenMiddleware, setUserRoadmap);

router.get(
  "/roadmaps",
  authenticateUserTokenMiddleware,
  fetchUserSelectedRoadmaps
);

router.get(
  "/notifications/all",
  authenticateUserTokenMiddleware,
  getAllUserNotifications
);

router.patch(
  "/notifications/mark-as-seen",
  authenticateUserTokenMiddleware,
  markNotificationsAsSeen
);

export default router;
