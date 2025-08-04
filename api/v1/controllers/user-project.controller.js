import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  submitProjectQuery,
  getLatestProjectSubmissionQuery,
  getProjectDetailsQuery,
} from "../services/user-common.query.js";

export const getProjectDetailsUnderRoadmapCourseController = async (req, res) => {
  const { contentRefId } = req.query;

  if (!contentRefId) {
    return sendApiError(res, { notifyUser: "Invalid Roadmap Course Id or Module Week" }, 400);
  }

  try {
    const projectDetails = await getProjectDetailsQuery(contentRefId);
    if (!projectDetails) {
      return sendApiError(res, { notifyUser: "Project details not found" }, 404);
    }
    return sendApiResponse(res, projectDetails);
  } catch (error) {
    logger.error(error, `error being received: [getProjectDetailsUnderRoadmapCourseController]`);
    return sendApiError(
      res,
      {
        notifyUser: error?.message ?? "Something went wrong. Please try again!",
      },
      500
    );
  }
};

export const submitProjectController = async (req, res) => {
  const userId = req.user.userId;
  const { contentRefId, githubUrl, docUrl, deployedUrl, submissionComment } = req.body;

  if (!contentRefId) {
    return sendApiError(res, { notifyUser: "Project Task ID is required." }, 400);
  }

  try {
    // Check latest submission for this user/project
    const latest = await getLatestProjectSubmissionQuery(userId, contentRefId);
    if (latest && latest.status !== "rejected") {
      return sendApiError(
        res,
        {
          notifyUser:
            "You have already submitted this project. Further submissions are only allowed if your last attempt was rejected.",
        },
        400
      );
    }
    // Attempt number
    const attemptNumber = latest ? latest.attemptNumber + 1 : 1;
    // Mark previous as not latest
    if (latest) {
      await submitProjectQuery.markPreviousNotLatest(latest.id);
    }
    // Insert new submission
    const submissionId = await submitProjectQuery.insert({
      userId,
      contentRefId,
      attemptNumber,
      githubUrl,
      docUrl,
      deployedUrl,
      submissionComment,
    });
    return sendApiResponse(res, { submissionId, notifyUser: "Project submitted successfully." });
  } catch (error) {
    logger.error(error, `[submitProjectController]`);
    return sendApiError(res, { notifyUser: error?.message ?? "Failed to submit project." }, 500);
  }
};
