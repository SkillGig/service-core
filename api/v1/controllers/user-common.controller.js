import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  transformRoadmapData,
  transformModuleData,
} from "../helpers/common.helper.js";
import {
  countUserNotifications,
  countUserUnreadNotifications,
  fetchUserNotificationsPaginated,
  getAllRoadmapsAvailableForUserToEnroll,
  getCourseDetailsQuery,
  getCourseFaqsQuery,
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

export const enrollUserToRoadmap = async (req, res) => {
  const userId = req.user.userId;
  const { roadmapId } = req.body;

  if (!roadmapId) {
    return sendApiError(res, { notifyUser: "Roadmap ID is required" }, 400);
  }

  try {
    const result = await setUserRoadmapQuery(userId, roadmapId);
    if (result.affectedRows > 0) {
      return sendApiResponse(res, { message: "Roadmap updated successfully" });
    } else {
      return sendApiError(res, { notifyUser: "Failed to update roadmap" }, 500);
    }
  } catch (error) {
    logger.error(error, "[enrollUserToRoadmap]");
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
      const faqs = await getCourseFaqsQuery(courseId);

      // Transform the module data to the desired format
      const transformedModules = transformModuleData(moduleData);

      return sendApiResponse(res, {
        courseDetails,
        tutorDetails,
        tags,
        learnings,
        reviews,
        faqs,
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
