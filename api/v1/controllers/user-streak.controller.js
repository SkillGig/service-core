import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import { ordinalSuffix } from "../helpers/common.helper.js";
import {
  checkIfUsersTaskIsAlreadyMarkedAsDone,
  findTemplateMappingForUserWithOrgQuery,
  getCurrentStreakCount,
  getDayTaskDetails,
  getUserCompletedTaskDescriptionsToday,
  getUserCreatedDate,
  getUserOrgId,
  getUserStreakStatusesForMonth,
  getWeeklyStreakStatus,
  getXPBreakdownAndTotal,
  markStreakAnimationAsSeenQuery,
  markTaskCompletedForUserAgainstTask,
  markTheStreakStatusForTodayQuery,
  shouldShowStreakAnimationToday,
} from "../services/user-streak.query.js";

export const completeUserTaskUsingTaskId = async (req, res) => {
  const userId = req.user.userId;
  const taskTemplateId = req.body.taskTemplateId;

  try {
    const taskTemplateMappingDetails =
      await findTemplateMappingForUserWithOrgQuery(userId, taskTemplateId);

    if (taskTemplateMappingDetails.length) {
      const checkIfUsersTaskIsAlreadyMarkedAsDoneResult =
        await checkIfUsersTaskIsAlreadyMarkedAsDone(userId);

      logger.debug(
        checkIfUsersTaskIsAlreadyMarkedAsDoneResult,
        `data being received: [checkIfUsersTaskIsAlreadyMarkedAsDoneResult]`
      );

      if (!checkIfUsersTaskIsAlreadyMarkedAsDoneResult) {
        const { orgId, xpPoints } = taskTemplateMappingDetails[0];
        const insertResult = await markTaskCompletedForUserAgainstTask(
          userId,
          orgId,
          taskTemplateId,
          xpPoints
        );

        await markTheStreakStatusForTodayQuery(userId);

        if (insertResult?.insertId) {
          return sendApiResponse(res, {
            notifyUser:
              "You have successfully completed the task and the xpPoints are added",
          });
        }
      } else {
        return sendApiError(res, {
          notifyUser: "Oops! The task is already marked as completed.",
        });
      }
    } else {
      return sendApiError(
        res,
        {
          notifyUser: `The requested template is not active for the organization that student belong or template doesn't exist. Please try with a valid templateId`,
        },
        401
      );
    }
  } catch (err) {
    logger.error(
      err,
      `error being received: [completeUserTaskUsingTaskId/error]`
    );
    return sendApiError(
      res,
      {
        notifyUser:
          "Something went wrong in marking the task as completed. Please try again!",
      },
      500
    );
  }
};

export const fetchTheDailyStreakSummary = async (req, res) => {
  const userId = req.user.userId;

  try {
    const [currentStreak, xpInfo, weekStreak] = await Promise.all([
      getCurrentStreakCount(userId),
      getXPBreakdownAndTotal(userId),
      getWeeklyStreakStatus(userId),
    ]);

    return sendApiResponse(res, {
      currentStreak,
      totalXP: xpInfo.totalXP,
      xpBreakdown: xpInfo.breakdown,
      weekStreakStatus: weekStreak,
    });
  } catch (err) {
    logger.error(err, "[fetchTheDailyStreakSummary/error]");
    return sendApiError(
      res,
      { notifyUser: "Unable to fetch streak summary." },
      500
    );
  }
};

export const fetchStreakCalendarForMonth = async (req, res) => {
  const userId = req.user.userId;
  const { month, year } = req.query;

  try {
    const createdDate = await getUserCreatedDate(userId);
    const streakRows = await getUserStreakStatusesForMonth(userId, month, year);

    const today = new Date();
    const todayISO = today.toISOString().split("T")[0];

    const streakMap = new Map(
      streakRows.map((row) => [
        new Date(row.streakDate).toISOString().split("T")[0],
        row.status,
      ])
    );

    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
          2,
          "0"
        )}`
      );
      const iso = date.toISOString().split("T")[0];

      if (date < createdDate) continue;

      let status = "inactive";
      if (iso > today) {
        status = "inactive";
      } else if (streakMap.has(iso)) {
        status = streakMap.get(iso);
      } else {
        status = "missed";
      }

      calendar.push({
        date: iso,
        status,
        isToday: iso === todayISO,
      });
    }

    return sendApiResponse(res, calendar);
  } catch (err) {
    logger.error(err, "[fetchStreakCalendarForMonth/error]");
    return sendApiError(
      res,
      { notifyUser: "Unable to fetch streak calendar" },
      500
    );
  }
};
export const fetchTaskDetailsForDay = async (req, res) => {
  const userId = req.user.userId;
  const { date } = req.query;

  try {
    const details = await getDayTaskDetails(userId, date);
    return sendApiResponse(res, details);
  } catch (err) {
    logger.error(err, "[fetchTaskDetailsForDay/error]");
    return sendApiError(
      res,
      { notifyUser: "Could not fetch task details" },
      500
    );
  }
};

export const getStreakPopupData = async (req, res) => {
  const userId = req.user.userId;

  try {
    const shouldShow = await shouldShowStreakAnimationToday(userId);
    if (!shouldShow) return sendApiResponse(res, { show: false });

    const [currentStreak, weekly, tasks] = await Promise.all([
      getCurrentStreakCount(userId),
      getWeeklyStreakStatus(userId),
      getUserCompletedTaskDescriptionsToday(userId),
    ]);

    const today = new Date();
    const todayFormatted = today
      .toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      .replace(/(\d+)(st|nd|rd|th)?/, (match, d) => `${d}${ordinalSuffix(d)}`);

    const weekStreak = weekly.map((day) => ({
      ...day,
      currentDay: day.streakDate === today.toISOString().split("T")[0],
    }));

    return sendApiResponse(res, {
      show: true,
      currentStreak,
      weekStreak,
      today: {
        date: todayFormatted,
        tasks,
      },
    });
  } catch (err) {
    logger.error(err, "[getStreakPopupData/error]");
    return sendApiError(res, { notifyUser: "Unable to load streak info" }, 500);
  }
};

export const markStreakAnimationAsSeen = async (req, res) => {
  const userId = req.user.userId;

  try {
    await markStreakAnimationAsSeenQuery(userId);
    return sendApiResponse(res, { message: "Streak animation marked as seen" });
  } catch (err) {
    logger.error(err, "[markStreakAnimationAsSeen/error]");
    return sendApiError(res, {
      notifyUser: "Failed to mark streak animation as seen"
    }, 500);
  }
};
