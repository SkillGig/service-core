import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  transformCourseSummary,
  transformModuleData,
  transformModuleDetails,
} from "../helpers/common.helper.js";
import {
  getModuleLevelCourseProgressQueryWithChapters,
  getUserRoadmapCourseOverallSummaryQuery,
  getCourseDetailsQuery,
  getCourseLearningsQuery,
  getCourseModulesQuery,
  getCourseReviewsQuery,
  getCourseTagsQuery,
  getCurrentRoadmapStatusQuery,
  getRoadmapCourseMappingDetailsUnderRoadmapQuery,
  getTotalSectionsUnderRoadmapCourseQuery,
  getTutorDetailsQuery,
  userCurrentRoadmapCourseStatusQuery,
  getCourseMappingDetailsQuery,
} from "../services/user-common.query.js";

export const getCourseDetails = async (req, res) => {
  const userId = req.user.userId;
  const { roadmapCourseId, roadmapId } = req.query;

  if (!roadmapCourseId || !roadmapId) {
    return sendApiError(res, { notifyUser: "Roadmap Course ID and Roadmap Id is required" }, 400);
  }

  try {
    const courseIdInfo = await getCourseMappingDetailsQuery(roadmapCourseId);
    if (!courseIdInfo?.courseId) {
      return sendApiError(res, { notifyUser: "Course not found" }, 404);
    }
    const courseId = courseIdInfo.courseId;

    // Fetch all course-related data in parallel
    const [courseDetails, tutorDetails, tags, learnings, reviews, moduleData, userStatusOfCourse] =
      await Promise.all([
        getCourseDetailsQuery(courseId),
        getTutorDetailsQuery(courseIdInfo.tutorId),
        getCourseTagsQuery(courseId),
        getCourseLearningsQuery(courseId),
        getCourseReviewsQuery(courseId),
        getCourseModulesQuery(courseId),
        userCurrentRoadmapCourseStatusQuery({ userId, roadmapId, roadmapCourseId }),
      ]);

    if (!courseDetails) {
      return sendApiError(res, { notifyUser: "Course not found" }, 404);
    }

    // Transform the module data to the desired format
    const transformedModules = transformModuleData(moduleData);

    // Helper to build preRequisiteCourseDetails
    const buildPreReqDetails = async (mappingDetails, isEnrolled, preReqCourse) => ({
      roadmapId: mappingDetails.roadmapId,
      roadmapCourseId: mappingDetails.preRequisiteCourseId,
      isEnrolled,
      completedModules: preReqCourse?.completedModules || 0,
      progressPercent: preReqCourse?.progressPercent || 0,
      totalModules: preReqCourse?.totalModules || preReqCourse?.totalModules || 0,
      courseTitle: preReqCourse?.courseTitle || "",
      courseDescription: preReqCourse?.courseDescription || "",
      courseThumbnailUrl: preReqCourse?.courseThumbnailUrl || "",
    });

    let currentRoadmapStatus = null;
    let currentRoadmapCourseStatus = null;
    let preRequisiteCourseDetails = null;
    let certificateUrl = null;

    if (!userStatusOfCourse) {
      const roadmapDetails = await getCurrentRoadmapStatusQuery(userId, roadmapId);
      if (roadmapDetails) {
        currentRoadmapStatus = "in-progress";
        const mappingDetails = await getRoadmapCourseMappingDetailsUnderRoadmapQuery(
          roadmapCourseId,
          roadmapId
        );
        logger.debug(
          { mappingDetails, userId, roadmapId },
          "Fetched roadmap course mapping details"
        );
        if (mappingDetails) {
          currentRoadmapCourseStatus = "locked";
          const preRequisiteCourse = await userCurrentRoadmapCourseStatusQuery({
            userId,
            roadmapId: mappingDetails.roadmapId,
            courseId: mappingDetails.preRequisiteCourseId,
          });
          if (preRequisiteCourse) {
            currentRoadmapCourseStatus = preRequisiteCourse.isCompleted
              ? "ready-to-enroll"
              : "in-progress";
            preRequisiteCourseDetails = await buildPreReqDetails(
              mappingDetails,
              true,
              preRequisiteCourse
            );
          } else {
            currentRoadmapCourseStatus = "locked";
            const preRequisiteCourse = await getTotalSectionsUnderRoadmapCourseQuery(
              mappingDetails.preRequisiteCourseId
            );
            preRequisiteCourseDetails = await buildPreReqDetails(
              mappingDetails,
              false,
              preRequisiteCourse
            );
          }
        }
      } else {
        currentRoadmapStatus = "not-enrolled";
        currentRoadmapCourseStatus = "not-enrolled";
      }
    } else {
      currentRoadmapStatus = "in-progress";
      currentRoadmapCourseStatus = userStatusOfCourse.isCompleted ? "completed" : "in-progress";
      certificateUrl = userStatusOfCourse.isCompleted
        ? userStatusOfCourse?.certificateUrl ?? null
        : null;
    }

    return sendApiResponse(res, {
      courseDetails,
      tutorDetails,
      tags,
      learnings,
      reviews,
      ...transformedModules,
      currentRoadmapStatus,
      currentRoadmapCourseStatus,
      certificateUrl,
      preRequisiteCourseDetails,
    });
  } catch (error) {
    logger.error(error, `error being received: [getCourseDetails]`);
    return sendApiError(res, { notifyUser: "Something went wrong. Please try again!" }, 500);
  }
};

export const getUserCourseSummaryController = async (req, res) => {
  const userId = req.user.userId;
  const { roadmapCourseId } = req.query;

  if (!roadmapCourseId) {
    return sendApiError(res, { notifyUser: "Invalid Roadmap Course Id" }, 400);
  }

  try {
    const userCourseOverallSummary = await getUserRoadmapCourseOverallSummaryQuery(
      userId,
      roadmapCourseId
    );
    if (!userCourseOverallSummary) {
      return sendApiError(res, { notifyUser: "Course not found" }, 404);
    }

    const transformedCourseSummary = transformCourseSummary(userCourseOverallSummary);
    logger.debug(
      transformedCourseSummary,
      `data being received: [userCourseOverallSummary/getUserCourseSummaryController]`
    );
    return sendApiResponse(res, transformedCourseSummary);
  } catch (error) {
    logger.error(error, `error being received: [getUserCourseSummaryController]`);
    return sendApiError(
      res,
      {
        notifyUser: error?.message ?? "Something went wrong. Please try again!",
      },
      500
    );
  }
};

export const getUserCourseModuleDetailsController = async (req, res) => {
  const userId = req.user.userId;
  const { roadmapCourseId, moduleWeek } = req.query;

  if (!roadmapCourseId || !moduleWeek) {
    return sendApiError(res, { notifyUser: "Invalid Roadmap Course Id or Module Week" }, 400);
  }

  try {
    const userCourseModuleDetails = await getModuleLevelCourseProgressQueryWithChapters(
      userId,
      roadmapCourseId,
      moduleWeek
    );
    const transformedModuleDetails = transformModuleDetails(userCourseModuleDetails);
    logger.debug(
      transformedModuleDetails,
      `data being received: [transformedModuleDetails/getUserCourseModuleDetailsController]`
    );
    return sendApiResponse(res, transformedModuleDetails);
  } catch (error) {
    logger.error(error, `error being received: [getUserCourseModuleDetailsController]`);
    return sendApiError(
      res,
      {
        notifyUser: error?.message ?? "Something went wrong. Please try again!",
      },
      500
    );
  }
};
