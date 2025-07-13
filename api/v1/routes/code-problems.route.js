import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import { getAllProblems, getProblemById, getDetailsByLanguageId } from "../controllers/code-problems.controller.js";

const router = Router();

router.get("/", authenticateUserTokenMiddleware, getAllProblems)
router.get("/:problemId", authenticateUserTokenMiddleware, getProblemById);
router.get("/:problemId/languages/:languageId", authenticateUserTokenMiddleware, getDetailsByLanguageId);
export default router;