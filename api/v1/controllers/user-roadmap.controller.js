import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import { transformRoadmapData } from "../helpers/common.helper.js";
import {
  getRoadmapDetailsQuery,
  getUserRoadmapQuery,
  getRoadmapCoursesWithStatusQuery,
  getAbstractUserEnrolledRoadmapAndCurrentCourseQuery,
  getUserCompletedCertificatesQuery,
  getUserOrgId,
} from "../services/user-common.query.js";
import logger from "../../../config/logger.js";
import Bluebird from "bluebird";
import { getOrgLeaderboardWithCurrentUser } from "../services/user-reward.query.js";
const Promise = Bluebird;

export const getRoadmapDetails = async (req, res) => {
  const { roadmapId } = req.query;

  if (!roadmapId) {
    return sendApiError(res, { notifyUser: "Roadmap ID is required" }, 400);
  }

  try {
    const roadmapDetails = await getRoadmapDetailsQuery(roadmapId);
    if (roadmapDetails.length) {
      const transformedData = transformRoadmapData(roadmapDetails);
      return sendApiResponse(res, transformedData);
    } else {
      return sendApiError(res, { notifyUser: "Roadmap not found or not enrolled" }, 404);
    }
  } catch (error) {
    logger.error(error, `error being received: [getRoadmapDetails]`);
    return sendApiError(
      res,
      {
        notifyUser: "Something went wrong. Please try again!",
      },
      500
    );
  }
};

export const fetchUserSelectedRoadmaps = async (req, res) => {
  const userId = req.user.userId;

  try {
    const userRoadmapResult = await getUserRoadmapQuery(userId);
    if (userRoadmapResult.length) {
      return sendApiResponse(res, {
        selectedRoadmaps: userRoadmapResult || [],
      });
    }
    return sendApiResponse(res, { selectedRoadmaps: [] }, 200);
  } catch (error) {
    logger.error(error, `error being received: [fetchUserSelectedRoadmaps]`);
    return sendApiError(
      res,
      {
        notifyUser: "Something went wrong. Please try again!",
      },
      500
    );
  }
};

export const getUserCurrentRoadmapDetails = async (req, res) => {
  const userId = req.user.userId;
  const roadmapId = req.query.roadmapId;

  try {
  } catch (error) {
    logger.error(error, `error being received: [getUserCurrentRoadmapDetails]`);
    return sendApiError(
      res,
      {
        notifyUser: "Something went wrong. Please try again!",
      },
      500
    );
  }
};

// export const fetchUserEnrolledRoadmapsWithCurrentCourse = async (req, res) => {
//   const userId = req.user.userId;

//   try {
//     const userEnrolledRoadmaps = await getUserEnrolledRoadmapsWithCurrentCourseQuery(userId);
//     if (userEnrolledRoadmaps.length) {

//     } else {
//       return sendApiResponse(res, { currentRoadmapDetails: [] });
//     }
//   } catch (error) {
//     logger.error(error, `error being received: [fetchUserEnrolledRoadmapsWithCurrentCourse]`);
//     return sendApiError(
//       res,
//       {
//         notifyUser: "Something went wrong. Please try again!",
//       },
//       500
//     );
//   }
// }

export const fetchUserEnrolledRoadmapAbstractDetails = async (req, res) => {
  const userId = req.user.userId;

  try {
    const orgDetails = await getUserOrgId(userId);
    const orgId = orgDetails[0].orgId;
    const [userEnrolledRoadmaps, userCompletedCourseCertificates, leaderboard] = await Promise.all([
      getAbstractUserEnrolledRoadmapAndCurrentCourseQuery(userId),
      getUserCompletedCertificatesQuery(userId),
      getOrgLeaderboardWithCurrentUser(userId, orgId),
    ]);
    return sendApiResponse(res, {
      currentRoadmapDetails: userEnrolledRoadmaps || [],
      userCompletedCourseCertificates: userCompletedCourseCertificates || [],
      analytics: {
        problemsSolved: 10,
        quizzesCompleted: 5,
        hourseSpent: 20,
      },
      leaderboard: leaderboard || [],
    });
  } catch (error) {
    logger.error(error, `error being received: [fetchUserEnrolledRoadmapAbstractDetails]`);
    return sendApiError(
      res,
      {
        notifyUser: "Something went wrong. Please try again!",
      },
      500
    );
  }
};

export const fetchDetailedRoadmapCoursesViewForUser = async (req, res) => {
  const userId = req.user.userId;
  const roadmapId = req.query.roadmapId;

  if (!roadmapId) {
    return sendApiError(res, { notifyUser: "Roadmap ID is required" }, 400);
  }
  try {
    const roadmapCoursesResult = await getRoadmapCoursesWithStatusQuery(userId, roadmapId);
    return sendApiResponse(res, {
      roadmapCoursesResult: roadmapCoursesResult || [],
    });
  } catch (error) {
    logger.error(error, `error being received: [fetchDetailedRoadmapViewForUser]`);
    return sendApiError(
      res,
      {
        notifyUser: "Something went wrong. Please try again!",
      },
      500
    );
  }
};