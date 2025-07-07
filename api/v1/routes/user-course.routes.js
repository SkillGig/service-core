import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  getCourseDetails,
  getUserCourseModuleDetailsController,
  getUserCourseSummaryController,
} from "../controllers/user-course.controller.js";
import {
  getUserNotesController,
  addUserNoteController,
  editUserNoteController,
} from "../controllers/user-notes.controller.js";
import {
  getProjectDetailsUnderRoadmapCourseController,
  submitProjectController,
} from "../controllers/user-project.controller.js";
const router = Router();

router.get("/course-details", authenticateUserTokenMiddleware, getCourseDetails);

router.get("/summary", authenticateUserTokenMiddleware, getUserCourseSummaryController);

router.get(
  "/module-details",
  authenticateUserTokenMiddleware,
  getUserCourseModuleDetailsController
);

// Notes APIs
router.get("/notes", authenticateUserTokenMiddleware, getUserNotesController);
router.post("/notes", authenticateUserTokenMiddleware, addUserNoteController);
router.put("/notes", authenticateUserTokenMiddleware, editUserNoteController);

// Project submission API
router.get(
  "/project-details",
  authenticateUserTokenMiddleware,
  getProjectDetailsUnderRoadmapCourseController
);
router.post("/project-submission", authenticateUserTokenMiddleware, submitProjectController);

export default router;
