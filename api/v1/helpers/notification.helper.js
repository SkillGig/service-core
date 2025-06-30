import { readFileToNconf } from "../../../config/index.js";
import axios from "axios";
import logger from "../../../config/logger.js";
const nconf = readFileToNconf();

/**
 * Calls the notification service to produce a new notification when a module is unlocked.
 * @param {Object} params - Notification parameters
 * @param {number} params.userId
 * @param {number} params.roadmapCourseId
 * @param {number} params.moduleWeek
 * @param {number} params.sectionId
 * @param {number} params.contentRefId
 * @param {string} params.title
 * @param {string} params.body
 * @param {string} params.actionUrl
 * @param {string} params.type
 * @param {string} params.source
 */
export const sendModuleUnlockedNotification = async ({
  userId,
  roadmapCourseId,
  moduleWeek,
  sectionId,
  contentRefId,
  title,
  body,
  actionUrl,
  type,
  source,
}) => {
  logger.debug(
    `Sending module unlocked notification for userId: ${userId}, roadmapCourseId: ${roadmapCourseId}, moduleWeek: ${moduleWeek}, sectionId: ${sectionId}, contentRefId: ${contentRefId}, title: ${title}, body: ${body}, actionUrl: ${actionUrl}, type: ${type}, source: ${source}`
  );
  const notificationService = nconf.get("notificationService");
  const url = `${notificationService.baseUrl}${notificationService.produceNewNotificationUrl}`;

  try {
    const response = await axios.post(url, {
      userId,
      roadmapCourseId,
      moduleWeek,
      sectionId,
      contentRefId,
      title,
      body,
      actionUrl,
      type,
      source,
    });
    logger.debug("Notification sent successfully:", response.data);
    if (response.status !== 200) {
      throw new Error(`Failed to send notification: ${response.statusText}`);
    }
    return response.data;
  } catch (error) {
    console.error("Notification API error:", error?.response?.data || error.message);
    throw error;
  }
};
