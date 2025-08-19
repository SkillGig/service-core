import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  calculateRoadmapForUser,
  getAvailableRoadmapsForUser,
  getQuestionsForUserOnboarding,
  submitUserResponses,
} from "../controllers/user-onboarding.controller.js";

const router = Router();

router.get("/available-roadmaps", authenticateUserTokenMiddleware, getAvailableRoadmapsForUser);

router.get("/questions", authenticateUserTokenMiddleware, getQuestionsForUserOnboarding);

router.post("/submit-response", authenticateUserTokenMiddleware, submitUserResponses);

router.post("/calculate-roadmap", authenticateUserTokenMiddleware, calculateRoadmapForUser)

export default router;
