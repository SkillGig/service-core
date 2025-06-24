import { query } from "../../../config/db.js";
import logger from "../../../config/logger.js";
import Bluebird from "bluebird";
const Promise = Bluebird;

export const countUserUnreadNotifications = async (userId) => {
  const queryString = `
    SELECT COUNT(*) AS unread FROM user_notifications WHERE user_id = ? AND seen = false
  `;

  try {
    const [result] = await query(queryString, [userId]);
    return result.unread || 0;
  } catch (error) {
    logger.error(error, "[countUserUnreadNotifications]");
    throw error;
  }
};

export const countUserNotifications = async (userId) => {
  const queryString = `
    SELECT COUNT(*) AS total FROM user_notifications WHERE user_id = ?
  `;

  try {
    const [result] = await query(queryString, [userId]);
    return result.total || 0;
  } catch (error) {
    logger.error(error, "[countUserNotifications]");
    throw error;
  }
};

export const fetchUserNotificationsPaginated = async (
  userId,
  page = 1,
  limit = 10
) => {
  const offset = (page - 1) * limit;

  const queryString = `
    SELECT 
      id AS notificationId,
      title,
      body,
      action_url AS actionUrl,
      type,
      seen,
      created_at AS createdAt
    FROM user_notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?;
  `;

  try {
    return await query(queryString, [userId, limit, offset]);
  } catch (error) {
    logger.error(error, "[fetchUserNotificationsPaginated]");
    throw error;
  }
};

export const markUserNotificationsAsSeen = async (userId, notificationIds) => {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw new Error("No notification IDs provided.");
  }

  const placeholders = notificationIds.map(() => "?").join(", ");

  const queryString = `
    UPDATE user_notifications
    SET seen = true, updated_at = NOW()
    WHERE user_id = ? AND id IN (${placeholders});
  `;

  try {
    return await query(queryString, [userId, ...notificationIds]);
  } catch (error) {
    logger.error(error, "[markUserNotificationsAsSeen]");
    throw error;
  }
};

export const userDetailsQuery = async (userId) => {
  logger.debug(userId, `data being received: [userDetailsQuery]`);

  const queryString = `SELECT u.id              AS userId,
       u.name            AS userName,
       u.org_id          AS organisationId,
       u.student_id      AS userStudentId,
       u.email           AS email,
       u.phone           AS phone,
       u.gender          AS gender,
       u.dob             AS dob,
       u.alternate_phone AS alternatePhone,
       u.enrolled_at     AS userEnrolledAt,
       u.is_disabled     AS disabled,
       u.is_verified     AS isVerified,
       o.name            AS organizationName,
       o.org_short_code  AS organizationShortCode,
       o.org_banner      AS organizationBanner,
       o.org_logo        AS organizationLogo,
       oec.show_connect  AS showConnect,
       oec.push_notifications AS enablePushNotifications,
       oec.show_flash_cards AS showFlashCards,
       oec.show_milestones AS showMilestones,
       oec.show_interview_prep AS showInterviewPrep,
       oec.show_focus_timer AS showFocusTimer,
       oec.show_user_roadmap AS showUserRoadmap,
       oec.show_leaderboard AS showLeaderBoard,
       oec.user_streaks  AS showUserStreaks,
       oec.show_quizzes AS showQuizzes,
       oec.branding_title AS brandingTitle,
       oec.branding_message AS brandingMessage
    FROM users u
            INNER JOIN organizations o ON u.org_id = o.id
            INNER JOIN org_extra_configs oec ON o.id = oec.org_id
    WHERE u.id = ? AND o.is_active = 1;`;
  try {
    const result = await query(queryString, [userId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [userDetailsQuery/error]`);
    throw error;
  }
};

export const setUserRoadmapQuery = async (userId, roadmapId) => {
  logger.debug(userId, `data being received: [setUserRoadmapQuery]`);

  const queryString = `
    INSERT INTO user_enrolled_roadmaps (user_id, roadmap_id)
    VALUES (?, ?)
  `;

  try {
    return await query(queryString, [roadmapId, userId]);
  } catch (error) {
    logger.error(error, `error being received: [setUserRoadmapQuery/error]`);
    throw error;
  }
};

export const getUserRoadmapQuery = async (userId) => {
  logger.debug(userId, `data being received: [getUserRoadmapQuery]`);

  const queryString = `
    SELECT roadmap_id as id
    FROM user_enrolled_roadmaps
    WHERE user_id = ?
  `;

  try {
    const result = await query(queryString, [userId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getUserRoadmapQuery/error]`);
    throw error;
  }
};

export const getRoadmapDetailsQuery = async (roadmapId) => {
  logger.debug(roadmapId, `data being received: [getRoadmapDetailsQuery]`);

  const queryString = `SELECT
      r.id AS roadmap_id,
      r.roadmap_name,
      c.id AS course_id,
      c.title AS course_title,
      c.thumbnail_url,
      c.level,
      t.name AS tutor_name,
      GROUP_CONCAT(DISTINCT tag.title) AS tags,
      AVG(cr.rating) AS rating,
      COUNT(DISTINCT uec.id) AS enrolled_count
    FROM roadmaps r
    JOIN roadmap_courses_mapping rcm ON rcm.roadmap_id = r.id
    JOIN courses c ON c.id = rcm.course_id
    JOIN tutors t ON t.id = c.tutor_id
    LEFT JOIN course_tags ct ON ct.course_id = c.id
    LEFT JOIN tags tag on ct.tag_id = tag.id
    LEFT JOIN course_reviews cr ON cr.course_id = c.id
    LEFT JOIN user_enrolled_courses uec ON uec.roadmap_course_id = rcm.id
    WHERE r.id = ?
      AND r.is_active = 1
      AND c.is_active = 1
    GROUP BY c.id
    ORDER BY rcm.order, c.level;`;

  try {
    const result = await query(queryString, [roadmapId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getRoadmapDetailsQuery/error]`);
    throw error;
  }
};

export const getAllRoadmapsAvailableForUserToEnroll = async (orgId) => {
  logger.debug(
    orgId,
    `data being received: [getAllRoadmapsAvailableForUserToEnroll]`
  );

  const queryString = `
    SELECT r.id AS roadmapId, r.roadmap_name AS roadmapName FROM org_roadmap_mapping orm
    INNER JOIN roadmaps r ON orm.roadmap_id = r.id
    WHERE orm.org_id = ? AND r.is_active = 1 AND orm.is_enabled = 1;
  `;

  try {
    return await query(queryString, [orgId]);
  } catch (error) {
    logger.error(
      error,
      `error being received: [getAllRoadmapsAvailableForUserToEnroll/error]`
    );
    throw error;
  }
};

export const getCourseDetailsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseDetailsQuery]`);

  const queryString = `
    SELECT id AS courseId, title AS courseTitle, description AS courseDescription, thumbnail_url AS imageUrl
    FROM courses WHERE id = ?;`;
  try {
    const result = await query(queryString, [courseId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getCourseDetailsQuery/error]`);
    throw error;
  }
};

export const getTutorDetailsQuery = async (tutorId) => {
  logger.debug(tutorId, `data being received: [getTutorDetailsQuery]`);

  const queryString = `
    SELECT id AS tutorId, name AS tutorName, description AS tutorBio, profile_picture AS profileImageUrl
    FROM tutors WHERE id = ?;`;
  try {
    const result = await query(queryString, [tutorId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getTutorDetailsQuery/error]`);
    throw error;
  }
};

export const getCourseTagsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseTagsQuery]`);

  const queryString = `
    SELECT t.id AS tagId, t.title AS tagTitle
    FROM course_tags ct
    INNER JOIN tags t ON ct.tag_id = t.id
    WHERE ct.course_id = ?;`;
  try {
    const result = await query(queryString, [courseId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getCourseTagsQuery/error]`);
    throw error;
  }
};

export const getCourseLearningsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseLearningsQuery]`);

  const queryString = `
    SELECT id AS learningId, title AS learningTitle, description AS learningDescription
    FROM course_learnings WHERE course_id = ? AND is_active = 1 ORDER BY display_order;`;
  try {
    const result = await query(queryString, [courseId]);
    return result;
  } catch (error) {
    logger.error(
      error,
      `error being received: [getCourseLearningsQuery/error]`
    );
    throw error;
  }
};

export const getCourseReviewsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseReviewsQuery]`);

  const queryString = `
    SELECT cr.id AS reviewId, cr.rating AS rating, cr.review AS review, cr.created_at AS createdAt,
           u.name AS reviewerName
    FROM course_reviews cr
    INNER JOIN users u ON cr.user_id = u.id
    WHERE cr.course_id = ? AND cr.is_active = 1
    ORDER BY cr.created_at DESC;`;
  try {
    const result = await query(queryString, [courseId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getCourseReviewsQuery/error]`);
    throw error;
  }
};

export const getCourseModulesQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseModulesQuery]`);

  const courseSummaryQueryString = `SELECT COUNT(DISTINCT s.module_week)                                 AS totalModules,
       COUNT(DISTINCT s.id)                                          AS totalSection,
       COUNT(DISTINCT ch.id)                                         AS totalChapters,
       SUM(CASE WHEN ch.content_type = 'video' THEN 1 ELSE 0 END)    AS totalVideos,
       SUM(CASE WHEN ch.content_type = 'document' THEN 1 ELSE 0 END) AS totalDocs,
       SUM(CASE WHEN ch.content_type = 'quiz' THEN 1 ELSE 0 END)     AS totalQuizzes,
       SUM(CASE WHEN ch.content_type = 'project' THEN 1 ELSE 0 END)  AS totalProjects,
       SUM(ch.content_duration)                                      AS courseDuration
    FROM sections s
            JOIN chapters ch ON ch.section_id = s.id
    WHERE s.course_id = ?
      AND s.is_active = 1
      AND ch.is_active = 1;`;

  const courseDetailsQueryString = `
    SELECT
      s.module_week,
      s.id AS sectionId,
      s.title AS sectionTitle,
      s.description AS sectionDescription,
      s.display_order AS sectionOrder,
      ch.content_duration AS sectionDuration,
      ch.id AS chapterId,
      ch.title AS chapterTitle,
      ch.content_type as contentType,
      ch.content_duration AS chapterDuration
    FROM sections s
    JOIN chapters ch ON ch.section_id = s.id
    WHERE s.course_id = ? AND s.is_active = 1 AND ch.is_active = 1
    GROUP BY s.module_week, s.id, ch.id
    ORDER BY s.module_week, s.display_order, ch.display_order;`;
  try {
    const [summaryResult, detailsResult] = await Promise.all([
      query(courseSummaryQueryString, [courseId]),
      query(courseDetailsQueryString, [courseId]),
    ]);
    return {
      summary: summaryResult[0] || {},
      details: detailsResult || [],
    };
  } catch (error) {
    logger.error(error, `error being received: [getCourseModulesQuery/error]`);
    throw error;
  }
};
