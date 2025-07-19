import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  transformCourseSummary,
  transformModuleData,
  transformModuleDetails,
  transformAllModuleDetails,
  transformAllModuleDetailsForNotEnrolledCourse,
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
  getProjectDetailsQuery,
  getCurrentSectionWithModuleForUserOngoingCourseQuery,
  getUserRoadmapOngoingCourseQuery,
  getUserRoadmapUpcomingCoursesQuery,
  getUserEnrolledRoadmapsQuery,
  getModuleDetailsBasedOnRoadmapCourseIdQuery,
  checkIfCourseIsAlreadyEnrolledToCourseQuery,
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
    const [
      courseDetails,
      tutorDetails,
      tags,
      learnings,
      reviews,
      moduleData,
      userStatusOfCourse,
      currentModuleDetails,
    ] = await Promise.all([
      getCourseDetailsQuery(courseId),
      getTutorDetailsQuery(courseIdInfo.tutorId),
      getCourseTagsQuery(courseId),
      getCourseLearningsQuery(courseId),
      getCourseReviewsQuery(courseId),
      getCourseModulesQuery(courseId),
      userCurrentRoadmapCourseStatusQuery({ userId, roadmapId, roadmapCourseId }),
      getCurrentSectionWithModuleForUserOngoingCourseQuery(userId, roadmapCourseId),
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
      if (roadmapDetails.length > 0) {
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

    // Determine ongoing current module week
    let ongoingCurrentModuleWeek = null;
    if (currentRoadmapCourseStatus === "in-progress") {
      ongoingCurrentModuleWeek = currentModuleDetails?.moduleWeek || 1;
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
      ongoingCurrentModuleWeek,
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

export const getChapterLockedStatusQuery = async (
  userId,
  roadmapCourseId,
  moduleWeek,
  sectionId,
  chapterId
) => {
  if (!userId || !roadmapCourseId || !moduleWeek || !sectionId || !chapterId) {
    throw new Error("Invalid parameters for chapter locked status check");
  }

  try {
    const chapterStatus = await getModuleLevelCourseProgressQueryWithChapters(
      userId,
      roadmapCourseId,
      moduleWeek,
      sectionId,
      chapterId
    );
    return chapterStatus?.isChapterUnlocked || false;
  } catch (error) {
    logger.error(error, `error being received: [getChapterLockedStatusQuery]`);
    throw new Error("Failed to fetch chapter locked status");
  }
};

// get the user current ongoing course details and upcoming courses in the roadmap
// the current ongoing course will be having the status of "in-progress" and the upcoming courses will be having the status of "locked" or "ready-to-enroll"
// the current ongoing course has to return the current module week, current section id, and current chapter id and chapter detail details like title, description and user watch progress from user_chapter_progress and the content_type of the chapter and if it is quiz or project then it should have quizMappingId and projectMappingId
export const getUserCurrentOngoingCourseDetailsController = async (req, res) => {
  const userId = req.user.userId;

  try {
    // get the ongoing course details
    const userEnrolledRoadmaps = await getUserEnrolledRoadmapsQuery(userId);
    if (!userEnrolledRoadmaps || userEnrolledRoadmaps.length === 0)
      return sendApiError(
        res,
        { notifyUser: "No enrolled roadmap found", action: "onboarding_questions" },
        404
      );

    const userEnrolledRoadmapId = userEnrolledRoadmaps[0].userEnrolledRoadmapId;

    const currentRoadmapId = userEnrolledRoadmaps[0].roadmapId;

    // Get current ongoing course details
    const ongoingCoursesDetails = await getUserRoadmapOngoingCourseQuery(userEnrolledRoadmapId);

    logger.debug(
      ongoingCoursesDetails,
      `data being received: [getUserCurrentOngoingCourseDetailsController/ongoingCoursesDetails]`
    );

    // Get upcoming courses in the roadmap
    const upcomingCourses = await getUserRoadmapUpcomingCoursesQuery(userId, currentRoadmapId);

    // Prepare response
    const response = {
      roadmapName:
        ongoingCoursesDetails?.length > 0
          ? ongoingCoursesDetails[0].roadmapName
          : userEnrolledRoadmaps[0].roadmapName,
      currentOngoingCourses: ongoingCoursesDetails
        ? ongoingCoursesDetails.map((course) => ({
            roadmapCourseId: course.roadmapCourseId,
            courseId: course.courseId,
            courseTitle: course.courseTitle,
            courseDescription: course.courseDescription,
            courseThumbnailUrl: course.courseThumbnailUrl,
            completedModules: course.completedModules,
            totalModules: course.totalModules,
            progressPercent: course.progressPercent,
            currentModuleWeek: course.currentModuleWeek,
            currentSectionId: course.currentSectionId,
            courseStatus: "in-progress",
            currentChapter: {
              chapterId: course.currentChapterId,
              title: course.chapterTitle,
              description: course.chapterDescription,
              contentType: course.contentType,
              contentRefId: course.contentRefId,
              userWatchDuration: course.userWatchDuration || 0,
              chapterTotalDuration: course.chapterTotalDuration || 0,
              isCompleted: course.isChapterCompleted,
              // Quiz attempt details
              ...(course.contentType === "quiz" &&
                course.currentQuizAttemptId && {
                  currentQuizAttempt: {
                    attemptId: course.quizAttemptId,
                    score: course.quizScore,
                    totalPoints: course.quizTotalPoints,
                    status: course.quizAttemptStatus,
                    startedAt: course.quizStartedAt,
                    completedAt: course.quizCompletedAt,
                  },
                }),
              // Project submission details
              ...(course.contentType === "project" &&
                course.latestProjectSubmissionId && {
                  latestProjectSubmission: {
                    submissionId: course.projectSubmissionId,
                    attemptNumber: course.projectAttemptNumber,
                    githubUrl: course.projectGithubUrl,
                    docUrl: course.projectDocUrl,
                    deployedUrl: course.projectDeployedUrl,
                    submissionComment: course.projectSubmissionComment,
                    status: course.projectSubmissionStatus,
                    tutorComment: course.projectTutorComment,
                    reviewedBy: course.projectReviewedBy,
                    submittedAt: course.projectSubmittedAt,
                    reviewedAt: course.projectReviewedAt,
                  },
                }),
            },
          }))
        : [],
      upcomingCourses: upcomingCourses.map((course) => ({
        roadmapCourseId: course.roadmapCourseId,
        courseId: course.courseId,
        courseTitle: course.courseTitle,
        courseDescription: course.courseDescription,
        courseThumbnailUrl: course.courseThumbnailUrl,
        estimatedDuration: course.estimatedDuration,
        orderSequence: course.orderSequence,
        courseStatus: course.courseStatus,
      })),
    };

    return sendApiResponse(res, response);
  } catch (error) {
    logger.error(error, `error being received: [getUserCurrentOngoingCourseDetailsController]`);
    return sendApiError(
      res,
      { notifyUser: error?.message ?? "Something went wrong. Please try again!" },
      500
    );
  }
};

export const getUserCourseDetailsController = async (req, res) => {
  const userId = req.user.userId;
  const { roadmapCourseId } = req.query;

  if (!roadmapCourseId) {
    return sendApiError(res, { notifyUser: "Invalid Roadmap Course Id" }, 400);
  }

  try {
    // check if the user is enrolled in the course
    const courseEnrolledStatus = await checkIfCourseIsAlreadyEnrolledToCourseQuery(
      userId,
      roadmapCourseId
    );

    let transformedAllModuleDetails;

    if (!courseEnrolledStatus) {
      // User is not enrolled - get basic course structure
      const userCourseModuleDetails = await getModuleDetailsBasedOnRoadmapCourseIdQuery(
        roadmapCourseId
      );
      transformedAllModuleDetails =
        transformAllModuleDetailsForNotEnrolledCourse(userCourseModuleDetails);
      logger.debug(
        transformedAllModuleDetails,
        `data being received: [transformAllModuleDetailsForNotEnrolledCourse/getUserCourseDetailsController]`
      );
    } else {
      // User is enrolled - get detailed progress data
      const userCourseModuleDetails = await getModuleLevelCourseProgressQueryWithChapters(
        userId,
        roadmapCourseId
      );
      transformedAllModuleDetails = transformAllModuleDetails(userCourseModuleDetails);
      logger.debug(
        transformedAllModuleDetails,
        `data being received: [transformAllModuleDetails/getUserCourseDetailsController]`
      );
    }

    return sendApiResponse(res, transformedAllModuleDetails);
  } catch (error) {
    logger.error(error, `error being received: [getUserCourseDetailsController]`);
    return sendApiError(
      res,
      {
        notifyUser: error?.message ?? "Something went wrong. Please try again!",
      },
      500
    );
  }
};
