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

  const placeholders = notificationIds.map(() => '?').join(', ');

  const queryString = `
    UPDATE user_notifications
    SET seen = true, updated_at = NOW()
    WHERE user_id = ? AND id IN (${placeholders});
  `;

  try {
    return await query(queryString, [userId, ...notificationIds]);
  } catch (error) {
    logger.error(error, '[markUserNotificationsAsSeen]');
    throw error;
  }
};

