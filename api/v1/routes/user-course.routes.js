import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import { getCourseDetails, getUserCourseModuleDetailsController, getUserCourseSummaryController } from "../controllers/user-course.controller.js";
const router = Router();

router.get("/course-details", authenticateUserTokenMiddleware, getCourseDetails);

router.get("/summary", authenticateUserTokenMiddleware, getUserCourseSummaryController);

router.get("/module-details", authenticateUserTokenMiddleware, getUserCourseModuleDetailsController);

export default router;
