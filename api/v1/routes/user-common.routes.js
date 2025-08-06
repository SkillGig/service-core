import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  getAllUserNotifications,
  markNotificationsAsSeen,
  enrollUserToRoadmap,
  userConfigController,
  unlockCourseForTheUserController,
  unlockModuleUnderCourseController,
  unlockSectionUnderCourseController,
  unlockChapterUnderCourseController,
} from "../controllers/user-common.controller.js";
import UserCodeProblemsRoute from "./code-problems.route.js";
import UserRoadmapMilestonesRoutes from "./user-roadmap.routes.js";
import UserCourseRoutes from "./user-course.routes.js";
import UserOnboardingRoutes from "./user-onboarding.routes.js";
import UserRewardRoutes from "./user-reward.routes.js";

const router = Router();

router.use("/course", UserCourseRoutes);

router.use("/code-problems", UserCodeProblemsRoute);

router.use("/roadmap", UserRoadmapMilestonesRoutes);

router.use("/rewards", UserRewardRoutes);

router.use("/onboarding", UserOnboardingRoutes);

router.get("/config", authenticateUserTokenMiddleware, userConfigController);

router.post("/enroll-roadmap", authenticateUserTokenMiddleware, enrollUserToRoadmap);

router.post("/enroll-course", authenticateUserTokenMiddleware, unlockCourseForTheUserController);

router.post("/unlock-module", authenticateUserTokenMiddleware, unlockModuleUnderCourseController);

router.post("/unlock-section", authenticateUserTokenMiddleware, unlockSectionUnderCourseController);

router.post("/unlock-chapter", authenticateUserTokenMiddleware, unlockChapterUnderCourseController);

router.get("/notifications/all", authenticateUserTokenMiddleware, getAllUserNotifications);

router.patch(
  "/notifications/mark-as-seen",
  authenticateUserTokenMiddleware,
  markNotificationsAsSeen
);

export default router;
