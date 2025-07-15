import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import { getAllProblemsQuery,
   getProblemByIdQuery,
   getAllLanguagesQuery,
   getDetailsByLanguageIdQuery
 } from "../services/code-problem.query.js";
import logger from "../../../config/logger.js";

export const getAllProblems = async (req, res) => {
   const userId = req.user.userId; 
   try {
      logger.info(`Fetching all problems for user ID: ${userId}`);
      const problems = await getAllProblemsQuery(userId);
      sendApiResponse(res, {
         success: true,
         data: problems,
      });
   } catch (error) {
      logger.error(`Error fetching problems for user ID: ${userId}`, error);
      sendApiError(res, {
         message: "Failed to fetch code problems"
      });
   }
}

export const getProblemById = async (req, res) => {
   const { problemId } = req.params;
   const userId = req.user.userId; 
   try {
      logger.info(`Fetching problem with ID: ${problemId} for user ID: ${userId}`);
      const problem = await getProblemByIdQuery(problemId, userId);
      const allLanguages = await getAllLanguagesQuery(); 
      if (!problem) {
         return sendApiError(res, 404, "Problem not found");
      }
      sendApiResponse(res, {
         success: true,
         data: {...problem, allLanguages},
      });
   } catch (error) {
      logger.error(`Error fetching problem with ID: ${problemId} for user ID: ${userId}`, error);
      sendApiError(res, "Failed to fetch code problem");
   }
}

export const getDetailsByLanguageId = async (req, res) => {
   const {problemId, languageId } = req.params;
   const userId = req.user.userId; 
   try {
      logger.info(`Fetching details for language ID: ${languageId} for user ID: ${userId}`);
      const languageDetails = await getDetailsByLanguageIdQuery(languageId, problemId);
      if (!languageDetails) {
         return sendApiError(res, 404, "Language details not found");
      }
      sendApiResponse(res, {
         success: true,
         data: languageDetails,
      });
   } catch (error) {
      logger.error(`Error fetching details for language ID: ${languageId} for user ID: ${userId}`, error);
      sendApiError(res, "Failed to fetch language details");
   }
}