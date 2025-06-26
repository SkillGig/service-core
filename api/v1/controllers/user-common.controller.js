import { pool, query } from "../../../config/db.js";
import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  transformRoadmapData,
  transformModuleData,
} from "../helpers/common.helper.js";
import { enrollUserToTheFirstCourseInRoadmap } from "../helpers/unlockers.helper.js";
import {
  checkUserOrgMultipleRoadmapsEnrollmentQuery,
  countUserNotifications,
  countUserUnreadNotifications,
  fetchUserNotificationsPaginated,
  getAllCoursesMappedUnderRoadmapQuery,
  getAllRoadmapsAvailableForUserToEnroll,
  getAllRoadmapsEnrolledByUserQuery,
  getCourseDetailsQuery,
  getCourseLearningsQuery,
  getCourseModulesQuery,
  getCourseReviewsQuery,
  getCourseTagsQuery,
  getRoadmapDetailsQuery,
  getTutorDetailsQuery,
  getUserRoadmapQuery,
  markUserNotificationsAsSeen,
  setUserRoadmapQuery,
  userDetailsQuery,
} from "../services/user-common.query.js";

export const getAllUserNotifications = async (req, res) => {
  const userId = req.user.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const [notifications, totalCount, totalUnread] = await Promise.all([
      fetchUserNotificationsPaginated(userId, page, limit),
      countUserNotifications(userId),
      countUserUnreadNotifications(userId),
    ]);

    const formatted = notifications.map((n) => ({
      notificationId: n.notificationId,
      title: n.title,
      body: n.body,
      actionUrl: n.actionUrl,
      type: n.type,
      seen: !!n.seen,
      createdAt: n.createdAt,
    }));

    return sendApiResponse(res, {
      notifications: formatted,
      totalUnread,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    logger.error(err, "[getAllUserNotifications]");
    return sendApiError(
      res,
      { notifyUser: "Unable to fetch notifications" },
      500
    );
  }
};

export const markNotificationsAsSeen = async (req, res) => {
  const userId = req.user.userId;
  const { notificationIds } = req.body;

  try {
    const result = await markUserNotificationsAsSeen(userId, notificationIds);
    return sendApiResponse(res, { updatedCount: result.affectedRows });
  } catch (err) {
    logger.error(err, "[markNotificationsAsSeen]");
    return sendApiError(
      res,
      { notifyUser: "Failed to mark notifications as seen." },
      500
    );
  }
};

export const userConfigController = async (req, res) => {
  const userId = req.user.userId;

  try {
    const userDetails = await userDetailsQuery(userId);
    if (userDetails.length) {
      const availableRoadmaps = await getAllRoadmapsAvailableForUserToEnroll(
        userDetails[0].organisationId
      );
      return sendApiResponse(res, {
        config: {
          ...userDetails[0],
          availableRoadmaps: availableRoadmaps || [],
        },
      });
    }
    return sendApiError(
      res,
      { notifyUser: "Invalid User!", action: "logout" },
      404
    );
  } catch (error) {
    logger.error(error, `error being received: [userConfigController]`);
    return sendApiError(
      res,
      {
        notifyUser: "Something went wrong. Please try again!",
      },
      500
    );
  }
};

/**
 * Enrolls a user to a roadmap and automatically enrolls them to the first course
 * Handles duplicate enrollment checks and organization-specific enrollment rules
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} API response with enrollment status
 */
export const enrollUserToRoadmap = async (req, res) => {
  const userId = req.user.userId;
  const { roadmapId } = req.body;

  try {
    // Validate input parameters
    if (!roadmapId) {
      logger.warn({ userId, roadmapId }, "Invalid roadmap ID provided for enrollment");
      return sendApiError(res, { notifyUser: "Invalid roadmap to enroll!" }, 400);
    }

    if (!userId) {
      logger.warn({ roadmapId }, "User ID not found in request");
      return sendApiError(res, { notifyUser: "User authentication required!" }, 401);
    }

    logger.info({ userId, roadmapId }, "Starting roadmap enrollment process");

    // Check if user is already enrolled in this roadmap
    const existingRoadmaps = await getAllRoadmapsEnrolledByUserQuery(userId);
    const isAlreadyEnrolled = existingRoadmaps.some((roadmap) => roadmap.roadmapId === roadmapId);

    if (isAlreadyEnrolled) {
      // Check if organization allows multiple roadmap enrollments
      const allowsMultipleEnrollments = await checkUserOrgMultipleRoadmapsEnrollmentQuery(userId);

      if (!allowsMultipleEnrollments) {
        logger.info(
          { userId, roadmapId },
          "User already enrolled in roadmap and organization doesn't allow multiple enrollments"
        );
        return sendApiError(
          res,
          { notifyUser: "You are already enrolled in this roadmap" },
          400
        );
      }

      logger.info(
        { userId, roadmapId },
        "User already enrolled but organization allows multiple enrollments"
      );
    }

    // Start database transaction for atomic enrollment
    await query("START TRANSACTION");

    try {
      // Step 1: Enroll user to roadmap
      const enrollmentResult = await setUserRoadmapQuery(userId, roadmapId);

      if (enrollmentResult.affectedRows === 0) {
        throw new Error("Failed to enroll user in roadmap - no database changes made");
      }

      // Step 2: Get all courses mapped under the roadmap
      const allCoursesInRoadmap = await getAllCoursesMappedUnderRoadmapQuery(roadmapId);

      if (!allCoursesInRoadmap || allCoursesInRoadmap.length === 0) {
        throw new Error("No courses found in this roadmap");
      }

      logger.debug(
        { userId, roadmapId, coursesCount: allCoursesInRoadmap.length },
        "Found courses in roadmap, proceeding with first course enrollment"
      );

      // Step 3: Enroll user to the first course in the roadmap
      const firstCourseEnrollment = await enrollUserToTheFirstCourseInRoadmap(
        allCoursesInRoadmap,
        userId
      );

      if (!firstCourseEnrollment.success) {
        throw new Error(`First course enrollment failed: ${firstCourseEnrollment.message}`);
      }

      // Commit transaction if all steps succeed
      await query("COMMIT");

      logger.info(
        { 
          userId, 
          roadmapId, 
          firstCourseId: allCoursesInRoadmap[0]?.courseId 
        },
        "Successfully enrolled user to roadmap and first course"
      );

      return sendApiResponse(res, { 
        message: "Roadmap enrolled successfully",
        data: {
          roadmapId,
          enrolledCourseId: allCoursesInRoadmap[0]?.courseId,
          totalCoursesInRoadmap: allCoursesInRoadmap.length
        }
      });

    } catch (transactionError) {
      // Rollback transaction on any error
      await query("ROLLBACK");
      
      logger.error(
        { 
          error: transactionError.message, 
          userId, 
          roadmapId 
        },
        "Transaction failed during roadmap enrollment"
      );

      // Determine appropriate error message based on error type
      let errorMessage = "Something went wrong. Please try again!";
      let statusCode = 500;

      if (transactionError.message.includes("No courses found")) {
        errorMessage = "No courses found in this roadmap";
        statusCode = 404;
      } else if (transactionError.message.includes("Failed to enroll")) {
        errorMessage = "Failed to enroll in roadmap";
        statusCode = 500;
      }

      return sendApiError(res, { notifyUser: errorMessage }, statusCode);
    }

  } catch (error) {
    logger.error(
      { 
        error: error.message, 
        stack: error.stack, 
        userId, 
        roadmapId 
      },
      "[enrollUserToRoadmap] Unexpected error during enrollment"
    );

    return sendApiError(
      res,
      { notifyUser: "Something went wrong. Please try again!" },
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

export const getRoadmapDetails = async (req, res) => {
  const userId = req.user.userId;
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
      return sendApiError(
        res,
        { notifyUser: "Roadmap not found or not enrolled" },
        404
      );
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

export const getCourseDetails = async (req, res) => {
  const { courseId } = req.query;

  if (!courseId) {
    return sendApiError(res, { notifyUser: "Course ID is required" }, 400);
  }

  try {
    // Assuming a function exists to fetch course details by ID
    const courseDetails = await getCourseDetailsQuery(courseId);
    if (courseDetails) {
      const tutorDetails = await getTutorDetailsQuery(courseDetails.tutorId);
      const tags = await getCourseTagsQuery(courseId);
      const learnings = await getCourseLearningsQuery(courseId);
      const reviews = await getCourseReviewsQuery(courseId);
      const moduleData = await getCourseModulesQuery(courseId);

      // Transform the module data to the desired format
      const transformedModules = transformModuleData(moduleData);

      return sendApiResponse(res, {
        courseDetails,
        tutorDetails,
        tags,
        learnings,
        reviews,
        ...transformedModules,
      });
    } else {
      return sendApiError(res, { notifyUser: "Course not found" }, 404);
    }
  } catch (error) {
    logger.error(error, `error being received: [getCourseDetails]`);
    return sendApiError(
      res,
      {
        notifyUser: "Something went wrong. Please try again!",
      },
      500
    );
  }
};
