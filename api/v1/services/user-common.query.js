import { query } from "../../../config/db.js";
import logger from "../../../config/logger.js";

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
