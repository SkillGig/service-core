import { query } from "../../../config/db.js";
import logger from "../../../config/logger.js";

export const getAllProblemsQuery = async (userId, search,   offset, limit, sortBy, order) => {
  try {
    const queryText = `
    SELECT 
      pps.id AS id,
      pps.title AS title,
      pps.difficulty AS difficulty,
      pps.time AS time,
      IFNULL(ps.status, 'unsolved') AS userStatus,
      ps.latest_submission_at AS latestSubmissionAt,
      GROUP_CONCAT(pt.name ORDER BY pt.name SEPARATOR ', ') AS tags,
      
      COUNT(DISTINCT solved.user_id) AS users_solved,
      COUNT(DISTINCT attempted.user_id) AS users_attempted,
      ROUND(
        IFNULL((COUNT(DISTINCT solved.user_id) / NULLIF(COUNT(DISTINCT attempted.user_id), 0)) * 100,
        0) ,2
      ) AS completionRate

    FROM programming_problem_statements pps
    
    LEFT JOIN (
      SELECT 
        question_id, 
        user_id, 
        status, 
        MAX(submission_at) AS latest_submission_at
      FROM programming_submissions
      WHERE user_id = ?
      GROUP BY question_id, user_id
    ) ps ON pps.id = ps.question_id

    LEFT JOIN programming_problem_tags ppt ON pps.id = ppt.problem_id
    LEFT JOIN programming_tags pt ON ppt.tag_id = pt.id

    LEFT JOIN programming_submissions attempted 
      ON attempted.question_id = pps.id
    LEFT JOIN programming_submissions solved 
      ON solved.question_id = pps.id AND solved.status = 'passed'
    
    WHERE pps.is_active = 1
        AND pps.title LIKE ?

    GROUP BY 
      pps.id, pps.title, pps.difficulty, pps.time, IFNULL(ps.status, 'unsolved')
    
    ORDER BY
      ${sortBy} ${order}
    LIMIT ? OFFSET ?;`;

    const problems = await query(queryText, [userId, search, limit, offset]);
    return problems;
  } catch (error) {
    logger.error(`Error fetching problems for user ID: ${userId}`, error);
    throw new Error("Failed to fetch code problems");
  }
};
export const getTotalProblemsCountQuery = async () => {
  try {
    const queryText = `
      SELECT COUNT(*) AS totalCount 
      FROM programming_problem_statements 
      WHERE is_active = 1;`;
    const result = await query(queryText);
    return result[0].totalCount;
  } catch (error) {
    logger.error("Error fetching total problems count", error);
    throw new Error("Failed to fetch total problems count");
  }
}


export const getProblemByIdQuery = async (problemId, userId) => {
  try {
    const DEFAULT_LANGUAGE_ID = 1; // Assuming 1 is the default language (Javascript) ID, adjust as necessary
    const queryText = `
      SELECT 
         pps.id AS id, 
         pps.title AS title, 
         pps.description AS description, 
         pps.difficulty AS difficulty, 

         ps.status AS userStatus,
         ps.submission_at AS userSubmissionDate,
         ps.code AS userCode,
         ps.language_id AS userLastUsedLanguageId,

         pql_user.starter_code AS userStarterCode,
         pql_user.default_stdin AS userDefaultStdIn,
         pql_user.expected_output AS userExpectedOutput,

         dpl.id AS defaultLanguageId,
         dpl.name AS defaultLanguageName,

         pql_default.starter_code AS defaultStarterCode,
         pql_default.default_stdin AS defaultStdIn,
         pql_default.expected_output AS expectedOutput

      FROM programming_problem_statements pps

      LEFT JOIN (
         SELECT * FROM programming_submissions 
         WHERE user_id = ? 
         ORDER BY submission_at DESC 
         LIMIT 1
      ) ps ON ps.question_id = pps.id

      LEFT JOIN programming_question_languages pql_user 
         ON pql_user.question_id = pps.id 
         AND pql_user.language_id = ps.language_id

      LEFT JOIN dim_programming_languages dpl 
         ON dpl.id = ${DEFAULT_LANGUAGE_ID}

      LEFT JOIN programming_question_languages pql_default 
         ON pql_default.question_id = pps.id 
         AND pql_default.language_id = ${DEFAULT_LANGUAGE_ID}

      WHERE pps.id = ? 
      AND pps.is_active = 1;`;

    const problem = await query(queryText, [userId, problemId]);
    return problem[0] || null; // Return the first result or null if not found
  } catch (error) {
    logger.error(`Error fetching problem with ID: ${problemId} for user ID: ${userId}`, error);
    throw new Error("Failed to fetch code problem");
  }
}

export const getAllLanguagesQuery = async()=>{
   try {
      const queryText = `
         SELECT id, name, slug 
         FROM dim_programming_languages 
         WHERE is_active = 1;`;
      const languages = await query(queryText);
      return languages;
   } catch (error) {
      logger.error("Error fetching all languages", error);
      throw new Error("Failed to fetch programming languages");
      
   }
}
export const getDetailsByLanguageIdQuery = async (languageId,problemId) => {
  try {
    const queryText = `
      SELECT 
         pql.id, 
         dpl.name, 
         dpl.slug, 
         pql.starter_code AS starterCode, 
         pql.default_stdin AS defaultStdIn, 
         pql.expected_output AS expectedOutput 
      FROM programming_question_languages pql
      JOIN dim_programming_languages dpl ON pql.language_id = dpl.id
      WHERE pql.language_id = ? AND pql.question_id = ?;`;

    const languageDetails = await query(queryText, [languageId, problemId]);
    return languageDetails[0]
  } catch (error) {
    logger.error(`Error fetching details for language ID: ${languageId}`, error);
    throw new Error("Failed to fetch language details");
  }
};