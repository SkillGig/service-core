import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import { getAllProblemsQuery,
   getProblemByIdQuery,
   getAllLanguagesQuery,
   getDetailsByLanguageIdQuery,
   getTotalProblemsCountQuery
 } from "../services/code-problem.query.js";
import logger from "../../../config/logger.js";

export const getAllProblems = async (req, res) => {
   const userId = req.user.userId; 
   const page = parseInt(req.query.page) || 1; 
   const limit = parseInt(req.query.limit) || 10;
   const offset = (page - 1) * limit;

   const sortBy = req.query.sortBy || 'title';
   const order = req.query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

   const allowedSortFields = ['title', 'difficulty','status'];
   let sortField = allowedSortFields.includes(sortBy) ? `pps.${sortBy}` : 'pps.title';

   try {
      logger.info(`Fetching all problems for user ID: ${userId}`);
      logger.debug(`Sorting by: ${sortField} ${order}, Page: ${page}, Limit: ${limit}`);
      const problems = await getAllProblemsQuery(userId, offset, limit, sortField, order);
      problems.forEach(problem => {
         problem.tags = problem.tags ? problem.tags.split(', ') : [];
         problem.completionRate = parseFloat(problem.completionRate);
      });
      const totalCount = await getTotalProblemsCountQuery();
      const totalPages = Math.ceil(totalCount / limit);

      sendApiResponse(res, {
         success: true,
         hasNextPage: page < totalPages,
         hasPreviousPage: page > 1,
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
      sendApiError(res, {
         message: "Failed to fetch code problem"
      });
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
      sendApiError(res, {
         message: "Failed to fetch language details"
      });
   }
}