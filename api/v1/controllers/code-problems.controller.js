import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  getAllProblemsQuery,
  getProblemByIdQuery,
  getAllLanguagesQuery,
  getDetailsByLanguageIdQuery,
  getTotalProblemsCountQuery,
  getProblemTestCasesQuery,
  submitProblemQuery,
  insertTestCaseResultsQuery
} from "../services/code-problem.query.js";
import logger from "../../../config/logger.js";
import axios from "axios";
import { readFileToNconf } from "../../../config/index.js";

const nconf = readFileToNconf("development/keys.json");

export const getAllProblems = async (req, res) => {
  const userId = req.user.userId;
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 10;
  let offset = (page - 1) * limit;
  const search = req.query.search || "";

  const sortBy = req.query.sortBy || "title";
  const order = ["ASC", "DESC"].includes(req.query.order?.toUpperCase())
    ? req.query.order.toUpperCase()
    : "ASC";

  const allowedSortFields = ["title", "difficulty", "status"];
  const sortField = allowedSortFields.includes(sortBy)
    ? `pps.${sortBy}`
    : "pps.title";


  let difficulty = req.query.difficulty || null;
  let status = req.query.status || null;
  let topic = req.query.topic || null;

  if (search.trim().length > 0) {
    limit = 10;
    page = 1;
    offset = 0;
    difficulty = null;
    status = null;
    topic = null;
  }
  logger.debug(`Search ${search}`);
  try {
    logger.info(`Fetching all problems for user ID: ${userId}`);
    logger.debug(
      `Sorting by: ${sortField} ${order}, Page: ${page}, Limit: ${limit}`
    );
    const problems = await getAllProblemsQuery(
      userId,
      search,
      offset,
      limit,
      sortField,
      order,
      difficulty,
      topic,
      status
    );

    problems.forEach((problem) => {
      problem.tags = problem.tags ? problem.tags.split(", ") : [];
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
      success: false,
      message: "Failed to fetch code problems",
    });
  }
};

export const getProblemById = async (req, res) => {
  const { problemId } = req.params;
  const userId = req.user.userId;
  try {
    logger.info(
      `Fetching problem with ID: ${problemId} for user ID: ${userId}`
    );
    const problem = await getProblemByIdQuery(problemId, userId);
    const allLanguages = await getAllLanguagesQuery();
    if (!problem) {
      return sendApiError(res, 404, "Problem not found");
    }
    sendApiResponse(res, {
      success: true,
      data: { ...problem, allLanguages },
    });
  } catch (error) {
    logger.error(
      `Error fetching problem with ID: ${problemId} for user ID: ${userId}`,
      error
    );
    sendApiError(res, {
      success: false,
      message: "Failed to fetch code problem",
    });
  }
};

export const getDetailsByLanguageId = async (req, res) => {
  const { problemId, languageId } = req.params;
  const userId = req.user.userId;
  try {
    logger.info(
      `Fetching details for language ID: ${languageId} for user ID: ${userId}`
    );
    const languageDetails = await getDetailsByLanguageIdQuery(
      languageId,
      problemId
    );
    if (!languageDetails) {
      return sendApiError(res, 404, "Language details not found");
    }
    sendApiResponse(res, {
      success: true,
      data: languageDetails,
    });
  } catch (error) {
    logger.error(
      `Error fetching details for language ID: ${languageId} for user ID: ${userId}`,
      error
    );
    sendApiError(res, {
      success: false,
      message: "Failed to fetch language details",
    });
  }
};

export const runTestCases = async (req, res) => {
  const { problemId } = req.params;
  const userId = req.user.userId;
  try {
    logger.info(
      `Running test cases for problem ID: ${problemId} by user ID: ${userId}`
    );
    const { languageId, sourceCode, stdin, expectedOutput } = req.body;
    const url = `${nconf.get(
      "programming:codeExecution:baseUrl"
    )}/submissions?base64_encoded=false&wait=true`;

    logger.debug("code execution url", url);
    const response = await axios.post(
      url,
      {
        language_id: languageId,
        source_code: sourceCode,
        stdin,
        expected_output: expectedOutput,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return sendApiResponse(res, {
      success: true,
      data: {
        status: response.data.status.description,
        output: response.data.stdout,
        time: response.data.time,
        memory: response.data.memory,
        error: response.data.stderr,
        compileOutput: response.data.compile_output,
        message: response.data.message,
      },
    });
  } catch (error) {
   logger.error(
      `Error running test cases for problem ID: ${problemId} by user ID: ${userId}`,
      error
    );
    return sendApiError(res, {
      message: "Failed to run test case",
      error: error.message,
    });
  }
};

export const submitProblem = async (req, res) => {
  const { problemId } = req.params;
  const userId = req.user.userId;
  try {
    logger.info(`Submitting problem ID: ${problemId} by user ID: ${userId}`);
    const { languageId, sourceCode } = req.body;
    const testCases = await getProblemTestCasesQuery(problemId);
    if (!testCases || testCases.length === 0) {
      return sendApiError(res, 404, "Problem test cases not found");
    }
    const url = `${nconf.get(
      "programming:codeExecution:baseUrl"
    )}/submissions?base64_encoded=false&wait=true`;

    logger.debug("code execution url", url);
    let passed = 0;
    let failed = 0;
    let results = [];

    for (const testCase of testCases) {
      const { input: stdin, output: expected_output } = testCase;

      try {
        const response = await axios.post(
          url,
          {
            language_id: languageId,
            source_code: sourceCode,
            stdin,
            expected_output,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const status = response.data.status.description;
        const passedTest = status === "Accepted";

        if (passedTest) passed++;
        else failed++;

        results.push({
          testCaseId: testCase.id,
          input: stdin,
          expectedOutput: expected_output,
          actualOutput: response.data.stdout,
          status,
          time: response.data.time,
          memory: response.data.memory,
          error: response.data.stderr,
          compileOutput: response.data.compile_output,
          token: response.data.token
        });
      } catch (err) {
        failed++;
        results.push({
          testCaseId: testCase.id,
          input: stdin,
          expected_output,
          error: err.message,
          status: "Error",
        });
      }
    }
    logger.info(
      `Test cases run completed for problem ID: ${problemId} by user ID: ${userId}`
    );
    if(results.length === 0) {
      return sendApiError(res, 404, "No test cases found for the problem");
    }
    const passedStatus = passed === testCases.length ? "passed" : "failed";
    const submitResultId = await submitProblemQuery(userId, problemId, languageId, sourceCode, passedStatus, passed, failed);
    logger.info(
      `Problem submission completed for user ID: ${userId} with result ID: ${submitResultId}`
    );
    sendApiResponse(res, {
      success: true,
      total: testCases.length,
      submitId: submitResultId,
      passed,
      failed,
      results,
    });

    await insertTestCaseResultsQuery(submitResultId, results);
    logger.info(
      `Problem submission of test cases completed for user ID: ${userId} with result ID: ${submitResultId}`
    );
  } catch (error) {
   logger.error(
      `Error submitting problem ID: ${problemId} by user ID: ${userId}`,
      error
    );
    return sendApiError(res, {
      message: "Failed to submit problem",
      error: error.message,
    });
  }
};
