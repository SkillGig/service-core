import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  fetchUserSelectedRoadmaps,
  getAllUserNotifications,
  markNotificationsAsSeen,
  enrollUserToRoadmap,
  userConfigController,
  getRoadmapDetails,
  getCourseDetails,
} from "../controllers/user-common.controller.js";
import UserStreaksRoutes from "./user-streak.routes.js";

const router = Router();

router.use("/streaks", authenticateUserTokenMiddleware, UserStreaksRoutes);

router.get("/config", authenticateUserTokenMiddleware, userConfigController);

router.post(
  "/enroll-roadmap",
  authenticateUserTokenMiddleware,
  enrollUserToRoadmap
);

router.get(
  "/roadmap-details",
  authenticateUserTokenMiddleware,
  getRoadmapDetails
);

router.get(
  "/course-details",
  authenticateUserTokenMiddleware,
  getCourseDetails
);

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
