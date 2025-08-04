import { validatorCallback } from "../helpers/validator.helper.js";

import { body, param } from "express-validator";


export const runTestCasesValidator = [
  param("problemId").isInt().withMessage("Problem ID must be an integer"),
  body("languageId")
   .notEmpty()
   .withMessage("Language ID is required")
   .isInt().withMessage("Language ID must be an integer"),
  body("sourceCode")
   .notEmpty()
   .withMessage("Source code is required")
   .isString().withMessage("Source code must be a string"),
  body("stdin").optional().isString().withMessage("Standard input must be a string"),
  body("expectedOutput").optional().isString().withMessage("Expected output must be a string"),
  (req, res, next) => validatorCallback(req, res, next)
];

export const submitProblemValidator = [
  param("problemId").isInt().withMessage("Problem ID must be an integer"),
  body("languageId")
   .notEmpty()
   .withMessage("Language ID is required")
   .isInt().withMessage("Language ID must be an integer"),
  body("sourceCode")
   .notEmpty()
   .withMessage("Source code is required")
   .isString().withMessage("Source code must be a string"),
  (req, res, next) => validatorCallback(req, res, next)
];