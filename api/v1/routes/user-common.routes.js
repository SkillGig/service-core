import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  fetchUserSelectedRoadmaps,
  getAllUserNotifications,
  markNotificationsAsSeen,
  enrollUserToRoadmap,
  userConfigController,
  getRoadmapDetails,
  unlockCourseForTheUserController,
  unlockModuleUnderCourseController,
  unlockSectionUnderCourseController,
  unlockChapterUnderCourseController,
} from "../controllers/user-common.controller.js";
import UserStreaksRoutes from "./user-streak.routes.js";
import UserCourseRoutes from "./user-course.routes.js";
import { getUserCurrentOngoingCourseDetailsController } from "../controllers/user-course.controller.js";

const router = Router();

router.use("/streaks", UserStreaksRoutes);

router.get("/config", authenticateUserTokenMiddleware, userConfigController);

router.get("/ongoing-upcoming-courses", authenticateUserTokenMiddleware, getUserCurrentOngoingCourseDetailsController);

router.post("/enroll-roadmap", authenticateUserTokenMiddleware, enrollUserToRoadmap);

router.post("/enroll-course", authenticateUserTokenMiddleware, unlockCourseForTheUserController);

router.post("/unlock-module", authenticateUserTokenMiddleware, unlockModuleUnderCourseController);

router.post("/unlock-section", authenticateUserTokenMiddleware, unlockSectionUnderCourseController);

router.post("/unlock-chapter", authenticateUserTokenMiddleware, unlockChapterUnderCourseController);

router.get("/roadmap-details", authenticateUserTokenMiddleware, getRoadmapDetails);

router.get("/roadmaps", authenticateUserTokenMiddleware, fetchUserSelectedRoadmaps);

router.use("/roadmap/roadmap-course", UserCourseRoutes);

router.get("/notifications/all", authenticateUserTokenMiddleware, getAllUserNotifications);

router.patch(
  "/notifications/mark-as-seen",
  authenticateUserTokenMiddleware,
  markNotificationsAsSeen
);

export default router;
