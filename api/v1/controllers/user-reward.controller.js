import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  getTaskTemplateDetailsQuery,
  checkDuplicateXPTransactionQuery,
  createXPTransactionQuery,
  updateUserLevelInfoQuery,
  updateUserStreakQuery,
  checkAndAwardBadgesQuery,
  getWeeklyStreakSummaryQuery,
  getMonthlyStreakSummaryQuery,
  getDayStreakBreakupQuery,
  getStreakStatusQuery,
  markAnimationSeenQuery,
  checkDailyLoginQuery,
  getDailyLoginTaskTemplateQuery,
  getUserAchievementsQuery,
} from "../services/user-reward.query.js";
import Bluebird from "bluebird";
import { sendUserNotification } from "../helpers/notification.helper.js";
const Promise = Bluebird;

export const awardXPForTask = async (req, res) => {
  const userId = req.user.userId;
  const {
    taskTemplateId,
    xpPoints: overrideXP,
    rewardTaskType,
    roadmapCourseId,
    moduleWeek,
    courseSectionId,
    courseChapterId,
    quizId,
    projectId,
  } = req.body;

  try {
    // 1. Validate taskTemplateId
    if (!taskTemplateId || !rewardTaskType) {
      let missingFields = [];
      if (!taskTemplateId) missingFields.push("task template ID");
      if (!rewardTaskType) missingFields.push("reward task type");
      return sendApiError(
        res,
        { notifyUser: `Missing required field(s): ${missingFields.join(", ")}` },
        400
      );
    }

    // 2. Get task template details
    const [taskTemplate] = await getTaskTemplateDetailsQuery(taskTemplateId);
    if (!taskTemplate.isActive) {
      return sendApiError(res, { notifyUser: "Invalid task template or task is inactive" }, 404);
    }

    // 3. Check for duplicate XP transaction
    const duplicateCheckData = {
      roadmapCourseId,
      moduleWeek,
      courseSectionId,
      courseChapterId,
      quizId,
      projectId,
    };

    const existingTransaction = await checkDuplicateXPTransactionQuery(
      userId,
      taskTemplateId,
      duplicateCheckData
    );

    if (existingTransaction) {
      logger.info(
        `Duplicate XP transaction detected for user ${userId}, task template ${taskTemplateId}. ` +
          `Existing transaction ID: ${existingTransaction.id}, XP: ${existingTransaction.xpPoints}, ` +
          `Created: ${existingTransaction.createdAt}`
      );

      return sendApiError(
        res,
        {
          notifyUser: "XP has already been awarded for this task",
          details: {
            existingTransactionId: existingTransaction.id,
            xpPoints: existingTransaction.xpPoints,
            awardedAt: existingTransaction.createdAt,
          },
        },
        409 // Conflict status code
      );
    }

    // Initialize task types array to track all types that need badge checking
    const taskTypes = [];

    // Initialize notifications array for successful events
    const notifications = [];

    // Get task type from template
    if (!taskTemplate.taskType) {
      return sendApiError(res, { notifyUser: "Task type is required" }, 400);
    }

    // Always include the original task type
    taskTypes.push(taskTemplate.taskType);

    // 4. Determine XP points to award
    const xpToAward = overrideXP || taskTemplate.xpPoints;

    // 5. Record XP transaction and update user's total XP/level
    const additionalTrackingData = {
      roadmapCourseId,
      moduleWeek,
      courseSectionId,
      courseChapterId,
      quizId,
      projectId,
    };

    await createXPTransactionQuery(
      userId,
      taskTemplateId,
      xpToAward,
      "TASK",
      additionalTrackingData
    );
    const levelUpdateResult = await updateUserLevelInfoQuery(userId, xpToAward);

    // Validate level update result
    if (!levelUpdateResult) {
      throw new Error("Failed to update user level information");
    }

    const { totalXp, newLevel } = levelUpdateResult;

    let response = {
      xpAwarded: xpToAward,
      totalXp,
      newLevel: newLevel || null,
    };

    // Add XP notification with additional tracking data
    notifications.push({
      type: "XP_EARNED",
      data: {
        userId,
        xpAwarded: xpToAward,
        totalXp,
        taskTemplateId,
        taskType: taskTemplate.taskType,
        rewardTaskType,
        roadmapCourseId,
        moduleWeek,
        courseSectionId,
        courseChapterId,
        quizId,
        projectId,
        timestamp: new Date().toISOString(),
      },
    });

    // Add level up notification if applicable
    if (newLevel) {
      notifications.push({
        type: "LEVEL_UP",
        data: {
          userId,
          newLevel: newLevel.level,
          levelName: newLevel.levelName,
          xpRequired: newLevel.xpRequired,
          totalXp,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 6. Update streak if task is streak-eligible
    let streakInfo = null;
    if (taskTemplate.isStreakEligible) {
      const streakResult = await updateUserStreakQuery(userId);
      response.streak = streakResult;

      // Only add 'streak' to task types if the streak was actually updated
      if (streakResult.wasUpdated) {
        taskTypes.push("streak");

        // Add streak notification
        notifications.push({
          type: "STREAK_UPDATED",
          data: {
            userId,
            currentStreak: streakResult.currentStreak,
            wasUpdated: streakResult.wasUpdated,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Store streak info for badge checking
      streakInfo = {
        currentStreak: streakResult.currentStreak,
      };
    }

    // 7. Check and award badges for all applicable task types using Promise.map
    const allAwardedBadges = await Promise.map(
      taskTypes,
      async (taskType) => {
        return await checkAndAwardBadgesQuery(userId, streakInfo, totalXp, taskType);
      },
      { concurrency: 1 }
    );

    // Combine and flatten all awarded badges
    const awardedBadges = [].concat(...allAwardedBadges).filter(Boolean);
    if (awardedBadges.length > 0) {
      response.newBadges = awardedBadges;

      // Add badge notifications
      awardedBadges.forEach((badge) => {
        notifications.push({
          type: "BADGE_EARNED",
          data: {
            userId,
            badge: {
              id: badge.id,
              name: badge.name,
              description: badge.description,
              type: badge.type,
              xpReward: badge.xpReward,
              taskType: badge.taskType,
              requirementType: badge.requirementType,
              unlockedAt: badge.unlockedAt,
            },
            timestamp: new Date().toISOString(),
          },
        });
      });
    }

    // Produce notifications via notification service
    await sendUserNotification(notifications);

    return sendApiResponse(res, response);
  } catch (err) {
    logger.error(err, "[awardXPForTask/error]");
    return sendApiError(res, { notifyUser: "Failed to award XP points" }, 500);
  }
};

export const getWeeklyStreakSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;

    // Get user's streak data from database
    const streakData = await getWeeklyStreakSummaryQuery(userId);

    // Helper function to format date to DD-MM-YYYY
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // Helper function to get day name
    const getDayName = (date) => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return days[date.getDay()];
    };

    // Get current week's dates (Monday to Sunday)
    const getCurrentWeekDates = () => {
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      // Calculate days since Monday (if today is Sunday, it should be 6 days since Monday)
      const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

      // Get Monday of current week
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysSinceMonday);
      monday.setHours(0, 0, 0, 0);

      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        weekDates.push(date);
      }

      return weekDates;
    };

    // Get current week dates
    const weekDates = getCurrentWeekDates();

    // Convert activity dates from database to comparable format
    const activityDates = streakData.weeklyActivities.map((date) => {
      if (typeof date === "string") {
        return new Date(date).toDateString();
      }
      return date.toDateString();
    });

    const currentDate = new Date();

    // Build week streak status
    const weekStreakStatus = weekDates.map((date) => {
      const isActive = activityDates.includes(date.toDateString());

      console.log(date, currentDate);

      // Compare only the date part (YYYY-MM-DD) to avoid gaps/overlaps
      const streakDateStr = date.toISOString().slice(0, 10);
      const currentDateStr = currentDate.toISOString().slice(0, 10);
      return {
        streakDate: formatDate(date),
        day: getDayName(date),
        status: isActive ? "done" : streakDateStr >= currentDateStr ? "yet-to-do" : "not-done",
        isCurrentDay: date.toDateString() === currentDate.toDateString(),
      };
    });

    const response = {
      currentStreak: streakData.currentStreak,
      totalXP: streakData.totalXp,
      weekStreakStatus,
    };

    return sendApiResponse(res, response);
  } catch (error) {
    logger.error(error, "[getWeeklyStreakSummary/error]");
    return sendApiError(res, { notifyUser: "Failed to retrieve weekly streak summary" }, 500);
  }
};

export const getMonthlySummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { month, year } = req.query;

    // Validate month and year parameters
    if (!month || !year) {
      return sendApiError(res, { notifyUser: "Month and year parameters are required" }, 400);
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Validate month range (1-12)
    if (monthNum < 1 || monthNum > 12) {
      return sendApiError(res, { notifyUser: "Month must be between 1 and 12" }, 400);
    }

    // Validate year range (current year ± 5)
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 5;
    const maxYear = currentYear + 5;
    if (yearNum < minYear || yearNum > maxYear) {
      return sendApiError(
        res,
        { notifyUser: `Year must be between ${minYear} and ${maxYear}` },
        400
      );
    }

    // Get user's monthly activity data
    const monthlyData = await getMonthlyStreakSummaryQuery(userId, monthNum, yearNum);

    // Helper function to format date to DD-MM-YYYY
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // Get all dates in the requested month
    const getDatesInMonth = (month, year) => {
      const dates = [];
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        dates.push(date);
      }

      return dates;
    };

    // Get current date for comparison
    const today = new Date();
    const todayDateString = today.toDateString();

    // Get all dates in the month
    const monthDates = getDatesInMonth(monthNum, yearNum);

    // Convert activity dates from database to comparable format
    const activityDates = monthlyData.monthlyActivities.map((date) => {
      if (typeof date === "string") {
        return new Date(date).toDateString();
      }
      return date.toDateString();
    });

    // Build monthly summary
    const monthlySummary = monthDates.map((date) => {
      const isActive = activityDates.includes(date.toDateString());
      const isToday = date.toDateString() === todayDateString;

      return {
        date: formatDate(date),
        status: isActive ? "done" : "not-done",
        isToday: isToday,
      };
    });

    return sendApiResponse(res, monthlySummary);
  } catch (error) {
    logger.error(error, "[getMonthlySummary/error]");
    return sendApiError(res, { notifyUser: "Failed to retrieve monthly summary" }, 500);
  }
};

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const getDayStreakBreakup = async (req, res) => {
  try {
    const userId = req.user?.userId;
    let { date } = req.query;

    // Validate userId
    if (!userId) {
      return sendApiError(res, { notifyUser: "User authentication required" }, 401);
    }

    if (!date) {
      const today = new Date();
      date = formatDate(today);
    }

    // Convert DD-MM-YYYY to YYYY-MM-DD for database query
    const [day, month, year] = date.split("-");
    const dbDate = `${year}-${month}-${day}`;

    // Validate that date is a valid date
    const parsedDate = new Date(dbDate);
    if (isNaN(parsedDate.getTime())) {
      return sendApiError(res, { notifyUser: "Invalid date provided" }, 400);
    }

    // Get detailed breakdown for the specific date
    const dayBreakup = await getDayStreakBreakupQuery(userId, dbDate);

    // Get user's streak data from database
    const streakData = await getWeeklyStreakSummaryQuery(userId);

    // Helper function to format date to DD-MM-YYYY

    // Helper function to get day name
    const getDayName = (date) => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return days[date.getDay()];
    };

    // Get current week's dates (Monday to Sunday)
    const getCurrentWeekDates = () => {
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      // Calculate days since Monday (if today is Sunday, it should be 6 days since Monday)
      const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

      // Get Monday of current week
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysSinceMonday);
      monday.setHours(0, 0, 0, 0);

      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        weekDates.push(date);
      }

      return weekDates;
    };

    // Get current week dates
    const weekDates = getCurrentWeekDates();

    // Convert activity dates from database to comparable format
    const activityDates = streakData.weeklyActivities.map((date) => {
      if (typeof date === "string") {
        return new Date(date).toDateString();
      }
      return date.toDateString();
    });

    const currentDate = new Date();

    // Build week streak status
    const weekStreakStatus = weekDates.map((date) => {
      const isActive = activityDates.includes(date.toDateString());

      console.log(date, currentDate);

      return {
        streakDate: formatDate(date),
        day: getDayName(date),
        status: isActive
          ? "done"
          : date.getDate() >= currentDate.getDate()
          ? "yet-to-do"
          : "not-done",
        isCurrentDay: date.toDateString() === currentDate.toDateString(),
      };
    });

    // Format the response
    const response = {
      date: dayBreakup.date,
      totalXp: dayBreakup.totalXpEarned,
      totalTasks: dayBreakup.totalTasks,
      hasActivity: dayBreakup.totalTasks > 0,
      weekStreakStatus,
      currentStreak: streakData.currentStreak,
      tasks: dayBreakup.tasks.map((task) => ({
        transactionId: task.transactionId,
        xpPoints: task.xpPoints,
        completedAt: task.completedAt,
        taskName: task.taskName,
        taskType: task.taskType,
        details: {
          courseName: task.courseName,
          chapterName: task.chapterName,
          quizName: task.quizName,
          projectName: task.projectName,
        },
      })),
    };

    return sendApiResponse(res, response);
  } catch (error) {
    logger.error(error, "[getDayStreakBreakup/error]");
    return sendApiError(res, { notifyUser: "Failed to retrieve day streak breakdown" }, 500);
  }
};

export const getStreakStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    logger.info(`Getting streak status for user: ${userId}`);

    const streakStatus = await getStreakStatusQuery(userId);

    const response = {
      success: true,
      data: {
        currentStreak: streakStatus.currentStreak,
        animationSeen: streakStatus.animationSeen,
        completedStreak: streakStatus.completedStreak,
        weeklyActivities: streakStatus.weeklyActivities,
        todayTasks: streakStatus.todayTasks.map((task) => ({
          transactionId: task.transactionId,
          xpPoints: task.xpPoints,
          completedAt: task.completedAt,
          taskName: task.taskName,
          taskType: task.taskType,
          courseName: task.courseName,
          roadmapName: task.roadmapName,
          chapterName: task.chapterName,
          quizName: task.quizName,
          projectName: task.projectName,
        })),
      },
    };

    return sendApiResponse(res, response);
  } catch (error) {
    logger.error(error, "[getStreakStatus/error]");
    return sendApiError(res, { notifyUser: "Failed to retrieve streak status" }, 500);
  }
};

export const markAnimationSeen = async (req, res) => {
  try {
    const userId = req.user.userId;

    await markAnimationSeenQuery(userId);
    const response = {
      success: true,
      message: "Animation marked as seen successfully",
    };

    return sendApiResponse(res, response);
  } catch (error) {
    logger.error(error, "[markAnimationSeen/error]");
    return sendApiError(res, { notifyUser: "Failed to mark animation as seen" }, 500);
  }
};

export const dailyLogin = async (req, res) => {
  try {
    const userId = req.user.userId;

    logger.info(`Processing daily login for user: ${userId}`);

    // 1. Check if user has already logged in today
    const existingLogin = await checkDailyLoginQuery(userId);

    if (existingLogin) {
      logger.info(
        `User ${userId} has already logged in today. Transaction ID: ${existingLogin.transactionId}`
      );

      return sendApiResponse(res, {
        success: true,
        alreadyLoggedIn: true,
        message: "Daily login already recorded for today",
        data: {
          transactionId: existingLogin.transactionId,
          xpAwarded: existingLogin.xpPoints,
          loginTime: existingLogin.loginTime,
          taskName: existingLogin.taskName,
        },
      });
    }

    // 2. Get daily login task template
    const dailyLoginTask = await getDailyLoginTaskTemplateQuery();

    if (!dailyLoginTask) {
      logger.error("Daily login task template not found or inactive");
      return sendApiError(res, { notifyUser: "Daily login reward system is not configured" }, 500);
    }

    // 3. Award XP for daily login (no duplicate tracking data needed for daily login)
    const additionalTrackingData = {
      roadmapCourseId: null,
      moduleWeek: null,
      courseSectionId: null,
      courseChapterId: null,
      quizId: null,
      projectId: null,
    };

    await createXPTransactionQuery(
      userId,
      dailyLoginTask.id,
      dailyLoginTask.xpPoints,
      "TASK",
      additionalTrackingData
    );

    // 4. Update user level
    const levelUpdateResult = await updateUserLevelInfoQuery(userId, dailyLoginTask.xpPoints);

    if (!levelUpdateResult) {
      throw new Error("Failed to update user level information");
    }

    const { totalXp, newLevel } = levelUpdateResult;

    // Initialize notifications array
    const notifications = [];

    // Add XP notification
    notifications.push({
      type: "XP_EARNED",
      data: {
        userId,
        xpAwarded: dailyLoginTask.xpPoints,
        totalXp,
        taskTemplateId: dailyLoginTask.id,
        taskType: dailyLoginTask.taskType,
        rewardTaskType: "daily_login",
        timestamp: new Date().toISOString(),
      },
    });

    let response = {
      success: true,
      alreadyLoggedIn: false,
      xpAwarded: dailyLoginTask.xpPoints,
      totalXp,
      newLevel: newLevel || null,
      taskName: dailyLoginTask.name,
    };

    // Add level up notification if applicable
    if (newLevel) {
      notifications.push({
        type: "LEVEL_UP",
        data: {
          userId,
          newLevel: newLevel.level,
          levelName: newLevel.levelName,
          xpRequired: newLevel.xpRequired,
          totalXp,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 5. Update streak if daily login is streak-eligible
    let streakInfo = null;
    if (dailyLoginTask.isStreakEligible) {
      const streakResult = await updateUserStreakQuery(userId);
      response.streak = streakResult;

      // Add streak notification if updated
      if (streakResult.wasUpdated) {
        notifications.push({
          type: "STREAK_UPDATED",
          data: {
            userId,
            currentStreak: streakResult.currentStreak,
            wasUpdated: streakResult.wasUpdated,
            timestamp: new Date().toISOString(),
          },
        });
      }

      streakInfo = {
        currentStreak: streakResult.currentStreak,
      };
    }

    // 6. Check and award badges for daily_login task type
    const taskTypes = [dailyLoginTask.taskType];

    // Add streak task type if streak was updated
    if (dailyLoginTask.isStreakEligible && response.streak?.wasUpdated) {
      taskTypes.push("streak");
    }

    const allAwardedBadges = await Promise.map(
      taskTypes,
      async (taskType) => {
        return await checkAndAwardBadgesQuery(userId, streakInfo, totalXp, taskType);
      },
      { concurrency: 1 }
    );

    // Combine and flatten all awarded badges
    const awardedBadges = [].concat(...allAwardedBadges).filter(Boolean);
    if (awardedBadges.length > 0) {
      response.newBadges = awardedBadges;

      // Add badge notifications
      awardedBadges.forEach((badge) => {
        notifications.push({
          type: "BADGE_EARNED",
          data: {
            userId,
            badge: {
              id: badge.id,
              name: badge.name,
              description: badge.description,
              type: badge.type,
              xpReward: badge.xpReward,
              taskType: badge.taskType,
              requirementType: badge.requirementType,
              unlockedAt: badge.unlockedAt,
            },
            timestamp: new Date().toISOString(),
          },
        });
      });
    }

    // Attach notifications to response
    response.notifications = notifications;

    return sendApiResponse(res, response);
  } catch (error) {
    logger.error(error, "[dailyLogin/error]");
    return sendApiError(res, { notifyUser: "Failed to process daily login" }, 500);
  }
};

export const getUserAchievements = async (req, res) => {
  try {
    const userId = req.user.userId;

    logger.info(`Getting achievements for user: ${userId}`);

    const achievements = await getUserAchievementsQuery(userId);

    // Format the response to match the screenshot structure
    const response = {
      success: true,
      data: {
        // Current level information
        currentLevel: achievements.userLevel
          ? {
              levelId: achievements.userLevel.levelId,
              levelName: achievements.userLevel.levelName,
              tier: achievements.userLevel.tier,
              tierLevel: achievements.userLevel.tierLevel,
              totalXp: achievements.userLevel.totalXp || 0,
              minXpRequired: achievements.userLevel.minXpRequired || 0,
              maxXpRequired: achievements.userLevel.maxXpRequired || 0,
            }
          : {
              levelId: null,
              levelName: "Beginner",
              tier: "BRONZE",
              tierLevel: "I",
              totalXp: 0,
              minXpRequired: 0,
              maxXpRequired: 100,
            },

        // Progress to next level
        progressToNextLevel: achievements.progressToNextLevel
          ? {
              currentXP: achievements.progressToNextLevel.currentXP,
              nextLevelXP: achievements.progressToNextLevel.nextLevelXP,
              xpNeededForNext: achievements.progressToNextLevel.xpNeededForNext,
              progressPercentage: achievements.progressToNextLevel.progressPercentage,
              nextLevel: achievements.progressToNextLevel.nextLevel,
            }
          : null,

        // User's earned badges/titles
        badges: achievements.userBadges.map((badge) => ({
          userBadgeId: badge.userBadgeId,
          badgeId: badge.badgeId,
          name: badge.badgeName,
          description: badge.badgeDescription,
          badgeType: badge.badgeType,
          requirements: badge.requirements,
          xpReward: badge.xpReward,
          isGlobal: badge.isGlobal,
          isActive: badge.isActive,
          unlockedAt: badge.unlockedAt,
        })),

        // Summary statistics
        summary: {
          totalXP: achievements.userLevel?.totalXp || 0,
          currentLevel: achievements.userLevel?.levelName || "Beginner",
          currentTier: achievements.userLevel?.tier || "BRONZE",
          currentTierLevel: achievements.userLevel?.tierLevel || "I",
          totalBadges: achievements.userBadges.length,
        },
      },
    };

    return sendApiResponse(res, response);
  } catch (error) {
    logger.error(error, "[getUserAchievements/error]");
    return sendApiError(res, { notifyUser: "Failed to retrieve user achievements" }, 500);
  }
};
