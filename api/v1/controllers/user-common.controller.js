import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  countUserNotifications,
  countUserUnreadNotifications,
  fetchUserNotificationsPaginated,
  markUserNotificationsAsSeen,
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
