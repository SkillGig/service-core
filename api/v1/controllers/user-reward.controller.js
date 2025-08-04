import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  getTaskTemplateDetailsQuery,
  createXPTransactionQuery,
  updateUserLevelInfoQuery,
  updateUserStreakQuery,
  checkAndAwardBadgesQuery,
} from "../services/user-reward.query.js";
import Bluebird from "bluebird";
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

    // 3. Determine XP points to award
    const xpToAward = overrideXP || taskTemplate.xpPoints;

    // 4. Record XP transaction and update user's total XP/level
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

    // 5. Update streak if task is streak-eligible
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

    // 6. Check and award badges for all applicable task types using Promise.map
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

    // Attach notifications to response for external notification service
    response.notifications = notifications;

    return sendApiResponse(res, response);
  } catch (err) {
    logger.error(err, "[awardXPForTask/error]");
    return sendApiError(res, { notifyUser: "Failed to award XP points" }, 500);
  }
};
