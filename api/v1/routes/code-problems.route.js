import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import { getAllProblems, 
   getProblemById, 
   getDetailsByLanguageId,
   runTestCases,
   submitProblem,
   getAllSubmissions
} from "../controllers/code-problems.controller.js";

import {
   runTestCasesValidator,
   submitProblemValidator
} from "../validators/code-problem.validator.js";

const router = Router();

router.get("/", authenticateUserTokenMiddleware, getAllProblems);
router.get("/:problemId", authenticateUserTokenMiddleware, getProblemById);
router.get("/:problemId/languages/:languageId", authenticateUserTokenMiddleware, getDetailsByLanguageId);
router.get("/submissions/:problemId", authenticateUserTokenMiddleware, getAllSubmissions);

router.post("/run/:problemId", 
   runTestCasesValidator,
   authenticateUserTokenMiddleware, 
   runTestCases
);

router.post("/submit/:problemId", 
   submitProblemValidator, 
   authenticateUserTokenMiddleware, 
   submitProblem
);

export default router;