import { getConnection, queryWithConn } from "../../../config/db.js";
import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import { transformRoadmapData, transformModuleData } from "../helpers/common.helper.js";
import { sendModuleUnlockedNotification } from "../helpers/notification.helper.js";
import {
  enrollUserToTheCourseInRoadmap,
  unlockChapterToUserUnderCourse,
  unlockModuleOfCourseToTheUser,
  unlockSectionUnderCourse,
} from "../helpers/unlockers.helper.js";
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
  getCourseMappingDetailsQuery,
  getCourseModulesQuery,
  getCourseReviewsQuery,
  getCourseTagsQuery,
  getCurrentRoadmapStatusQuery,
  getPrerequisiteCourseQuery,
  getRoadmapCourseMappingDetailsUnderRoadmapQuery,
  getRoadmapDetailsQuery,
  getTotalSectionsUnderRoadmapCourseQuery,
  getTutorDetailsQuery,
  getUserCourseCompletionStatusQuery,
  getUserRoadmapQuery,
  markUserNotificationsAsSeen,
  setUserRoadmapQuery,
  userCurrentRoadmapCourseStatusQuery,
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
    return sendApiError(res, { notifyUser: "Unable to fetch notifications" }, 500);
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
    return sendApiError(res, { notifyUser: "Failed to mark notifications as seen." }, 500);
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
    return sendApiError(res, { notifyUser: "Invalid User!", action: "logout" }, 404);
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

  let conn;
  try {
    if (!roadmapId) {
      logger.warn({ userId, roadmapId }, "Invalid roadmap ID provided for enrollment");
      return sendApiError(res, { notifyUser: "Invalid roadmap to enroll!" }, 400);
    }
    if (!userId) {
      logger.warn({ roadmapId }, "User ID not found in request");
      return sendApiError(res, { notifyUser: "User authentication required!" }, 401);
    }
    logger.info({ userId, roadmapId }, "Starting roadmap enrollment process");

    // Use a single connection for the transaction
    conn = await getConnection();
    try {
      // Check if user is already enrolled in this roadmap
      const existingRoadmaps = await getAllRoadmapsEnrolledByUserQuery(userId, conn);
      const isAlreadyEnrolled = existingRoadmaps.some((roadmap) => roadmap.roadmapId === roadmapId);
      if (isAlreadyEnrolled) {
        // instead of a flag have the number of roadmaps that user can enroll at a time in org level
        const allowsMultipleEnrollments = await checkUserOrgMultipleRoadmapsEnrollmentQuery(
          userId,
          conn
        );
        if (!allowsMultipleEnrollments) {
          logger.info(
            { userId, roadmapId },
            "User already enrolled in roadmap and organization doesn't allow multiple enrollments"
          );
          conn.release();
          return sendApiError(res, { notifyUser: "You are already enrolled in this roadmap" }, 400);
        }
        logger.info(
          { userId, roadmapId },
          "User already enrolled but organization allows multiple enrollments"
        );
      }
      await queryWithConn(conn, "START TRANSACTION");
      // Step 1: Enroll user to roadmap
      const enrollmentResult = await setUserRoadmapQuery(userId, roadmapId, conn);
      if (enrollmentResult.affectedRows === 0) {
        throw new Error("Failed to enroll user in roadmap - no database changes made");
      }
      // Step 2: Get all courses mapped under the roadmap
      const allCoursesInRoadmap = await getAllCoursesMappedUnderRoadmapQuery(roadmapId, conn);
      if (!allCoursesInRoadmap || allCoursesInRoadmap.length === 0) {
        throw new Error("No courses found in this roadmap");
      }
      logger.debug(
        {
          userId,
          roadmapId,
          coursesCount: allCoursesInRoadmap.length,
          userRoadmapId: enrollmentResult.insertId,
        },
        "Found courses in roadmap, proceeding with first course enrollment"
      );
      // Step 3: Enroll user to the first course in the roadmap

      const firstCourseEnrollment = await enrollUserToTheCourseInRoadmap(
        {
          courseId: allCoursesInRoadmap[0]?.courseId,
          roadmapCourseId: allCoursesInRoadmap[0]?.roadmapCourseId,
          isWeeklyUnlock: allCoursesInRoadmap[0]?.isWeeklyUnlock,
        },
        userId,
        enrollmentResult.insertId,
        conn
      );
      if (!firstCourseEnrollment.success) {
        throw new Error(`First course enrollment failed: ${firstCourseEnrollment.message}`);
      }
      await queryWithConn(conn, "COMMIT");
      conn.release();
      // send notification for roadmap enrollment

      await sendModuleUnlockedNotification({
        userId,
        roadmapCourseId: allCoursesInRoadmap[0]?.roadmapCourseId,
        moduleWeek: null,
        sectionId: null,
        contentRefId: null,
        title: "Roadmap Enrolled",
        body: `You have successfully enrolled in the roadmap: ${allCoursesInRoadmap[0]?.roadmapName}`,
        actionUrl: `/user/roadmaps/${enrollmentResult.insertId}`,
        type: "roadmap-enrolled",
        source: "system",
      });
      return sendApiResponse(res, {
        message: "Roadmap enrolled successfully",
        data: {
          roadmapId,
          enrolledRoadmapId: enrollmentResult.insertId,
          enrolledRoadmapCourseId: allCoursesInRoadmap[0]?.roadmapCourseId,
        },
      });
    } catch (transactionError) {
      try {
        await queryWithConn(conn, "ROLLBACK");
      } catch (rollbackError) {
        logger.error(
          { rollbackError: rollbackError.message, userId, roadmapId },
          "Rollback failed during roadmap enrollment"
        );
      }
      if (conn) conn.release();
      logger.error(
        { error: transactionError.message, userId, roadmapId },
        "Transaction failed during roadmap enrollment"
      );
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
    if (conn) conn.release();
    logger.error(
      { error: error.message, stack: error.stack, userId, roadmapId },
      "[enrollUserToRoadmap] Unexpected error during enrollment"
    );
    return sendApiError(res, { notifyUser: "Something went wrong. Please try again!" }, 500);
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
      userStatusOfCourse
    ] = await Promise.all([
      getCourseDetailsQuery(courseId),
      getTutorDetailsQuery(courseIdInfo.tutorId),
      getCourseTagsQuery(courseId),
      getCourseLearningsQuery(courseId),
      getCourseReviewsQuery(courseId),
      getCourseModulesQuery(courseId),
      userCurrentRoadmapCourseStatusQuery({ userId, roadmapId, roadmapCourseId })
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
      completedSections: preReqCourse?.completedSections || 0,
      progressPercent: preReqCourse?.progressPercent || 0,
      totalSections: preReqCourse?.totalSections || preReqCourse?.totalSection || 0,
      courseTitle: preReqCourse?.courseTitle || "",
      courseDescription: preReqCourse?.courseDescription || "",
      courseThumbnailUrl: preReqCourse?.courseThumbnailUrl || "",
    });

    let currentRoadmapStatus = null;
    let currentRoadmapCourseStatus = null;
    let preRequisiteCourseDetails = null;

    if (!userStatusOfCourse) {
      const roadmapDetails = await getCurrentRoadmapStatusQuery(userId, roadmapId);
      if (roadmapDetails) {
        currentRoadmapStatus = "in-progress";
        const mappingDetails = await getRoadmapCourseMappingDetailsUnderRoadmapQuery(roadmapCourseId, roadmapId);
        logger.debug({ mappingDetails, userId, roadmapId }, "Fetched roadmap course mapping details");
        if (mappingDetails) {
          currentRoadmapCourseStatus = "locked";
          const preRequisiteCourse = await userCurrentRoadmapCourseStatusQuery({
            userId,
            roadmapId: mappingDetails.roadmapId,
            courseId: mappingDetails.preRequisiteCourseId,
          });
          if (preRequisiteCourse) {
            currentRoadmapCourseStatus = preRequisiteCourse.isCompleted ? "ready-to-enroll" : "in-progress";
            preRequisiteCourseDetails = await buildPreReqDetails(mappingDetails, true, preRequisiteCourse);
          } else {
            currentRoadmapCourseStatus = "locked";
            const preRequisiteCourse = await getTotalSectionsUnderRoadmapCourseQuery(mappingDetails.preRequisiteCourseId);
            preRequisiteCourseDetails = await buildPreReqDetails(mappingDetails, false, preRequisiteCourse);
          }
        }
      } else {
        currentRoadmapStatus = "not-enrolled";
        currentRoadmapCourseStatus = "not-enrolled";
      }
    } else {
      currentRoadmapStatus = "in-progress";
      currentRoadmapCourseStatus = userStatusOfCourse.isCompleted ? "completed" : "in-progress";
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
      preRequisiteCourseDetails,
    });
  } catch (error) {
    logger.error(error, `error being received: [getCourseDetails]`);
    return sendApiError(
      res,
      { notifyUser: "Something went wrong. Please try again!" },
      500
    );
  }
};

export const unlockCourseForTheUserController = async (req, res) => {
  const userId = req.user.userId || req.body.userId;
  const { roadmapCourseId, roadmapId } = req.body;

  if (!roadmapCourseId || !roadmapId) {
    return sendApiError(res, { notifyUser: "Invalid roadmapCourseId or roadmapId" }, 400);
  }

  let conn;

  try {
    conn = await getConnection();
    const prerequisiteCourse = await getPrerequisiteCourseQuery(roadmapCourseId);
    if (!prerequisiteCourse) {
      const courseDetailsToEnroll = await getCourseMappingDetailsQuery(roadmapCourseId);
      if (!courseDetailsToEnroll) {
        await queryWithConn(conn, "ROLLBACK");
        conn.release();
        return sendApiError(res, { notifyUser: "Course not found" }, 404);
      }
      await queryWithConn(conn, "START TRANSACTION");
      const unlockResult = await enrollUserToTheCourseInRoadmap(
        {
          courseId: courseDetailsToEnroll.courseId,
          roadmapCourseId,
          isWeeklyUnlock: courseDetailsToEnroll.isWeeklyUnlock,
        },
        userId,
        roadmapId,
        conn
      );
      if (unlockResult.success) {
        await queryWithConn(conn, "COMMIT");
        conn.release();
        // send notification for course unlock
        await sendModuleUnlockedNotification({
          userId,
          roadmapCourseId,
          moduleWeek: null,
          sectionId: null,
          contentRefId: null,
          title: "Course Unlocked",
          body: `You have successfully unlocked the course.`,
          actionUrl: `/user/courses/${roadmapCourseId}`,
          type: "course-enrolled",
          source: "system",
        });
        return sendApiResponse(res, {
          message: "Course unlocked successfully",
          data: {
            roadmapCourseId,
            roadmapId,
          },
        });
      }
      await queryWithConn(conn, "ROLLBACK");
      conn.release();
      return sendApiError(res, { notifyUser: unlockResult.message }, 500);
    }
    // check if the prerequisite course is already completed by the user
    const isPrerequisiteCompleted = await getUserCourseCompletionStatusQuery(
      userId,
      prerequisiteCourse.roadmapId,
      prerequisiteCourse.prerequisiteCourseId,
      conn
    );
    if (isPrerequisiteCompleted && isPrerequisiteCompleted.isCompleted) {
      const courseDetailsToEnroll = await getCourseMappingDetailsQuery(roadmapCourseId);
      if (!courseDetailsToEnroll) {
        await queryWithConn(conn, "ROLLBACK");
        conn.release();
        return sendApiError(res, { notifyUser: "Course not found" }, 404);
      }
      await queryWithConn(conn, "START TRANSACTION");
      const unlockResult = await enrollUserToTheCourseInRoadmap(
        {
          courseId: courseDetailsToEnroll.courseId,
          roadmapCourseId,
          isWeeklyUnlock: courseDetailsToEnroll.isWeeklyUnlock,
        },
        userId,
        roadmapId,
        conn
      );
      if (unlockResult.success) {
        await queryWithConn(conn, "COMMIT");
        conn.release();
        return sendApiResponse(res, {
          message: "Course unlocked successfully",
          data: {
            roadmapCourseId,
            roadmapId,
          },
        });
      }
      await queryWithConn(conn, "ROLLBACK");
      conn.release();
      return sendApiError(res, { notifyUser: unlockResult.message }, 500);
    } else {
      await queryWithConn(conn, "ROLLBACK");
      conn.release();
      return sendApiError(
        res,
        {
          notifyUser: "You need to complete the prerequisite course before unlocking this course.",
        },
        400
      );
    }
  } catch (error) {
    if (conn) {
      await queryWithConn(conn, "ROLLBACK");
      conn.release();
    }
    logger.error(error, `error being received: [unlockCourseForTheUser]`);
    return sendApiError(
      res,
      {
        notifyUser: "Something went wrong. Please try again!",
      },
      500
    );
  }
};

export const unlockModuleUnderCourseController = async (req, res) => {
  const userId = req.user.userId || req.body.userId;
  const { roadmapCourseId, moduleId } = req.body;

  if (!roadmapCourseId || !moduleId) {
    return sendApiError(res, { notifyUser: "Invalid roadmapCourseId or moduleId" }, 400);
  }

  let conn;
  try {
    conn = await getConnection();
    await queryWithConn(conn, "START TRANSACTION");

    const unlockModuleResult = await unlockModuleOfCourseToTheUser({
      userId,
      roadmapCourseId,
      moduleId,
      conn,
    });
    if (unlockModuleResult.success) {
      await queryWithConn(conn, "COMMIT");
      conn.release();
      return sendApiResponse(res, {
        message: "Module unlocked successfully",
        data: {
          roadmapCourseId,
          moduleId,
        },
      });
    }
    await queryWithConn(conn, "ROLLBACK");
    conn.release();
    return sendApiError(res, { notifyUser: unlockModuleResult.message }, 500);
  } catch (error) {
    logger.error(error, `error being received: [unlockModuleUnderCourseController]`);
    return sendApiError(
      res,
      {
        notifyUser: error?.message ?? "Something went wrong. Please try again!",
      },
      500
    );
  }
};

export const unlockSectionUnderCourseController = async (req, res) => {
  const userId = req.user.userId || req.body.userId;
  const { roadmapCourseId, sectionId } = req.body;

  if (!roadmapCourseId || !sectionId) {
    return sendApiError(res, { notifyUser: "Invalid roadmapCourseId or sectionId" }, 400);
  }

  let conn;
  try {
    conn = await getConnection();
    await queryWithConn(conn, "START TRANSACTION");

    const unlockSectionResult = await unlockSectionUnderCourse({
      userId,
      roadmapCourseId,
      sectionId,
      conn,
    });
    if (unlockSectionResult.success) {
      await queryWithConn(conn, "COMMIT");
      conn.release();
      return sendApiResponse(res, {
        message: "Section unlocked successfully",
        data: {
          roadmapCourseId,
          sectionId,
        },
      });
    }
    await queryWithConn(conn, "ROLLBACK");
    conn.release();
    return sendApiError(res, { notifyUser: unlockSectionResult.message }, 500);
  } catch (error) {
    logger.error(error, `error being received: [unlockSectionUnderCourseController]`);
    return sendApiError(
      res,
      {
        notifyUser: error?.message ?? "Something went wrong. Please try again!",
      },
      500
    );
  }
};

export const unlockChapterUnderCourseController = async (req, res) => {
  const userId = req.user.userId || req.body.userId;
  const { roadmapCourseId, sectionId, chapterId } = req.body;

  if (!roadmapCourseId || !sectionId || !chapterId) {
    return sendApiError(
      res,
      { notifyUser: "Invalid roadmapCourseId or sectionId or chapterId" },
      400
    );
  }

  let conn;
  try {
    conn = await getConnection();
    await queryWithConn(conn, "START TRANSACTION");

    const unlockChapterResult = await unlockChapterToUserUnderCourse({
      userId,
      roadmapCourseId,
      sectionId,
      chapterId,
      conn,
    });
    if (unlockChapterResult.success) {
      await queryWithConn(conn, "COMMIT");
      conn.release();
      return sendApiResponse(res, {
        message: "Chapter unlocked successfully",
        data: {
          roadmapCourseId,
          chapterId,
        },
      });
    }

    await queryWithConn(conn, "ROLLBACK");
    conn.release();
    return sendApiError(res, { notifyUser: unlockChapterResult.message }, 500);
  } catch (error) {
    logger.error(error, `error being received: [unlockChapterUnderCourseController]`);
    if (conn) {
      await queryWithConn(conn, "ROLLBACK");
      conn.release();
    }
    return sendApiError(
      res,
      {
        notifyUser: error?.message ?? "Something went wrong. Please try again!",
      },
      500
    );
  }
};
