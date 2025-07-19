import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  fetchDetailedRoadmapCoursesViewForUser,
  fetchUserEnrolledRoadmapAbstractDetails,
  fetchUserSelectedRoadmaps,
  getRoadmapDetails,
} from "../controllers/user-roadmap.controller.js";

const router = Router();

router.get("/roadmap-details", authenticateUserTokenMiddleware, getRoadmapDetails);

router.get("/roadmaps", authenticateUserTokenMiddleware, fetchUserSelectedRoadmaps);

router.get(
  "/ongoing-roadmap-with-analytics",
  authenticateUserTokenMiddleware,
  fetchUserEnrolledRoadmapAbstractDetails
);

router.get(
  "/ongoing-roadmap-course-view",
  authenticateUserTokenMiddleware,
  fetchDetailedRoadmapCoursesViewForUser
)

// router.use("/roadmap/roadmap-course", UserCourseRoutes);

export default router;
