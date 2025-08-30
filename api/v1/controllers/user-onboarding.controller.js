import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import { calculateRecommendedRoadmap } from "../helpers/onboarding.helper.js";
import {
  getAvailableRoamapsQueryController,
  getNextOnboardingQuestion,
  getOptionsMappedForQuestion,
  getTotalOnboardingQuestions,
  getUserResponsesForRoadmapCalculation,
  resetUserOnboardingResponses,
  submitUserResponsesQueryController,
} from "../services/user-onboarding.query.js";

export const getAvailableRoadmapsForUser = async (req, res) => {
  const userId = req.user.userId;

  try {
    const availableRoadmaps = await getAvailableRoamapsQueryController(userId);
    if (!availableRoadmaps || availableRoadmaps.length === 0) {
      return sendApiError(
        res,
        {
          notifyUser: "No available roadmaps found for your organization.",
        },
        404
      );
    }
    return res.status(200).json({
      success: true,
      data: availableRoadmaps,
      message: "Available roadmaps fetched successfully.",
    });
  } catch (error) {
    logger.error(`Error fetching available roadmaps for user ${userId}:`, error);
    return sendApiError(
      res,
      {
        notifyUser: "Failed to fetch available roadmaps. Please try again later.",
      },
      500
    );
  }
};

export const getQuestionsForUserOnboarding = async (req, res) => {
  const userId = req.user.userId;
  const previousQuestionId = parseInt(req.query.previousQuestionId) || 0;

  try {
    logger.debug(
      userId,
      previousQuestionId === 0,
      `data being received: [getQuestionsForUserOnboarding]`
    );
    if (previousQuestionId === 0) {
      await resetUserOnboardingResponses(userId);
    }

    const nextQuestionDetails = await getNextOnboardingQuestion(userId, previousQuestionId);

    const userQuestionCompletionProgress = await getTotalOnboardingQuestions(userId);

    if (!nextQuestionDetails) {
      return sendApiError(
        res,
        {
          nextQuestionDetails: null,
          userQuestionCompletionProgress,
        },
        200
      );
    }
    return sendApiResponse(res, {
      nextQuestionDetails,
      userQuestionCompletionProgress,
    });
  } catch (error) {
    logger.error(`Error fetching questions for user ${userId}:`, error);
    return sendApiError(
      res,
      {
        notifyUser: "Failed to fetch questions. Please try again later.",
      },
      500
    );
  }
};

export const submitUserResponses = async (req, res) => {
  const userId = req.user.userId;
  const questionId = req.body.questionId;
  const selectedOptions = req.body.selectedOptions;

  if (!selectedOptions || !selectedOptions.length || !questionId) {
    return sendApiError(
      res,
      {
        notifyUser: "Invalid response format. Please provide valid selectedOptions.",
      },
      400
    );
  }

  try {
    // check if the options in selectedOptions match the question's options
    const existingOptions = await getOptionsMappedForQuestion(questionId, userId);
    const validOptions = existingOptions.map((option) => parseInt(option.optionId));
    const invalidOptions = selectedOptions.filter((option) => !validOptions.includes(option));
    if (invalidOptions.length > 0) {
      return sendApiError(
        res,
        {
          notifyUser: "Some selected options are invalid. Please check your responses.",
        },
        400
      );
    }
    const result = await submitUserResponsesQueryController(userId, questionId, selectedOptions);
    if (!result) {
      return sendApiError(
        res,
        {
          notifyUser: "Failed to submit responses. Please try again later.",
        },
        500
      );
    }

    return sendApiResponse(res, {
      notifyUser: "Responses submitted successfully.",
    });
  } catch (error) {
    logger.error(`Error submitting responses for user ${userId}:`, error);
    return sendApiError(
      res,
      {
        notifyUser: "Failed to submit responses. Please try again later.",
      },
      500
    );
  }
};

export const calculateRoadmapForUser = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Get all user responses with associated roadmap weights and option details
    const usersAnswers = await getUserResponsesForRoadmapCalculation(userId);

    if (!usersAnswers || usersAnswers.length === 0) {
      return sendApiError(
        res,
        {
          notifyUser:
            "No responses found for the user. Please complete the onboarding questions first.",
        },
        404
      );
    }

    const roadmapCalculation = calculateRecommendedRoadmap(usersAnswers);

    if (!roadmapCalculation) {
      return sendApiError(
        res,
        {
          notifyUser: "Unable to calculate roadmap recommendations. Please try again later.",
        },
        500
      );
    }

    // Prepare response based on whether there's a tie or single recommendation
    if (roadmapCalculation.isTie) {
      // still need to work on this part
      return sendApiResponse(res, {
        data: {
          recommendations: roadmapCalculation.recommendedRoadmaps,
          isTieBreaker: roadmapCalculation.isTie,
          message: `Found ${roadmapCalculation.recommendedRoadmaps.length} roadmaps with equal
          scores. Consider your preferences to choose.`,
          allScores: roadmapCalculation.allScores, // For debugging or additional insights
        },
      });
    }
    const responseData = {
      recommendations: roadmapCalculation.recommendedRoadmaps,
      isTieBreaker: roadmapCalculation.isTie,
      message: roadmapCalculation.isTie
        ? `Found ${roadmapCalculation.recommendedRoadmaps.length} roadmaps with equal scores. Consider your preferences to choose.`
        : "Roadmap recommendation calculated successfully.",
      allScores: roadmapCalculation.allScores, // For debugging or additional insights
    };

    return sendApiResponse(res, {
      data: responseData,
      message: "Roadmap calculated successfully.",
    });
  } catch (error) {
    logger.error(`Error calculating roadmap for user ${userId}:`, error);
    return sendApiError(
      res,
      {
        notifyUser: "Failed to calculate roadmap. Please try again later.",
      },
      500
    );
  }
};
