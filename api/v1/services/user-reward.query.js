import { query } from "../../../config/db.js";
import logger from "../../../config/logger.js";
import Bluebird from "bluebird";
const Promise = Bluebird;

export const getTaskTemplateDetailsQuery = async (taskTemplateId) => {
  const queryString = `
    SELECT 
      id, 
      name, 
      xp_points as xpPoints, 
      is_streak_eligible as isStreakEligible,
      is_active as isActive,
      task_type as taskType
    FROM task_templates 
    WHERE id = ? AND is_active = 1
  `;

  try {
    const result = await query(queryString, [taskTemplateId]);
    return result;
  } catch (error) {
    logger.error(error, "[getTaskTemplateDetailsQuery]");
    throw error;
  }
};

export const createXPTransactionQuery = async (
  userId,
  taskTemplateId,
  xpPoints,
  source_type = "TASK",
  additionalData = {}
) => {
  try {
    // Extract additional tracking data
    const {
      roadmapCourseId = null,
      moduleWeek = null,
      courseSectionId = null,
      courseChapterId = null,
      quizId = null,
      projectId = null,
    } = additionalData;

    const queryString = `
      INSERT INTO xp_transactions (
        user_id, 
        task_template_id, 
        xp_points, 
        source_type,
        transaction_type,
        roadmap_course_id,
        module_week,
        course_section_id,
        course_chapter_id,
        quiz_id,
        project_id
      ) VALUES (?, ?, ?, ?, 'EARN', ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(queryString, [
      userId,
      taskTemplateId,
      xpPoints,
      source_type,
      roadmapCourseId,
      moduleWeek,
      courseSectionId,
      courseChapterId,
      quizId,
      projectId,
    ]);
    return result;
  } catch (error) {
    logger.error(error, "[createXPTransactionQuery/error]");
    throw error;
  }
};

export const updateUserLevelInfoQuery = async (userId, xpToAdd) => {
  try {
    // Check if user entry exists
    const checkUserQuery = `
      SELECT 
        total_xp as totalXp,
        current_level_id as currentLevelId
      FROM user_level_info
      WHERE user_id = ?;
    `;
    const [existingUser] = await query(checkUserQuery, [userId]);

    let newTotalXp;
    let previousLevelId = null;

    if (!existingUser) {
      // New user - total XP will be just the XP to add
      newTotalXp = xpToAdd;
    } else {
      // Existing user - add XP to current total
      newTotalXp = existingUser.totalXp + xpToAdd;
      previousLevelId = existingUser.currentLevelId;
    }

    // Find appropriate level based on new total XP
    const findLevelQuery = `
      SELECT 
        id,
        level_name as levelName,
        tier,
        tier_level as tierLevel,
        min_xp_required as minXpRequired,
        max_xp_required as maxXpRequired
      FROM levels
      WHERE min_xp_required <= ? AND max_xp_required >= ? AND is_active = 1
      ORDER BY min_xp_required DESC
      LIMIT 1
    `;
    const [newLevel] = await query(findLevelQuery, [newTotalXp, newTotalXp]);

    const newLevelId = newLevel ? newLevel.id : null;

    if (!existingUser) {
      // Insert new entry for new user
      const insertQuery = `
        INSERT INTO user_level_info (user_id, total_xp, current_level_id)
        VALUES (?, ?, ?)
      `;
      await query(insertQuery, [userId, newTotalXp, newLevelId]);
    } else {
      // Update existing user
      const updateQuery = `
        UPDATE user_level_info 
        SET total_xp = ?, current_level_id = ?
        WHERE user_id = ?
      `;
      await query(updateQuery, [newTotalXp, newLevelId, userId]);
    }

    // Return level up info only if level actually changed
    let levelUpInfo = null;
    if (newLevel && newLevelId !== previousLevelId) {
      levelUpInfo = {
        id: newLevel.id,
        level: newLevel.id,
        levelName: newLevel.levelName,
        tier: newLevel.tier,
        tierLevel: newLevel.tierLevel,
        xpRequired: newLevel.minXpRequired,
      };
    }

    return {
      totalXp: newTotalXp,
      newLevel: levelUpInfo,
    };
  } catch (error) {
    logger.error(error, "[updateUserLevelInfoQuery/error]");
    throw error;
  }
};

export const updateUserStreakQuery = async (userId) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // First, check if streak is already updated for today
    const checkStreakQuery = `
      SELECT 
        last_activity_date as lastActivityDate,
        current_streak as currentStreak
      FROM user_streaks 
      WHERE user_id = ? AND last_activity_date = CURRENT_DATE
    `;
    const [existingStreak] = await query(checkStreakQuery, [userId]);

    // If streak is already marked for today, return false indicating no update
    if (existingStreak) {
      return {
        wasUpdated: false,
        currentStreak: existingStreak.currentStreak,
      };
    }

    // If no streak for today, proceed with update
    const updateStreakQuery = `
      INSERT INTO user_streaks (user_id, current_streak, longest_streak, streak_start_date, last_activity_date)
      VALUES (?, 1, 1, CURRENT_DATE, CURRENT_DATE)
      ON DUPLICATE KEY UPDATE 
        current_streak = IF(last_activity_date = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), 
                           current_streak + 1, 
                           1),
        longest_streak = GREATEST(longest_streak, 
                                IF(last_activity_date = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), 
                                   current_streak + 1, 
                                   1)),
        last_activity_date = CURRENT_DATE,
        streak_start_date = IF(last_activity_date = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), 
                              streak_start_date, 
                              CURRENT_DATE)
    `;
    await query(updateStreakQuery, [userId]);

    // Get the updated streak info
    const getStreakQuery = `
      SELECT 
        current_streak as currentStreak,
        streak_start_date as streakStartDate,
        last_activity_date as lastActivityDate
      FROM user_streaks
      WHERE user_id = ?
    `;
    const [streakInfo] = await query(getStreakQuery, [userId]);

    // Log streak history if streak ended (only when streak is reset to 1)
    if (streakInfo.currentStreak === 1 && streakInfo.streakStartDate !== today) {
      const logHistoryQuery = `
        INSERT INTO user_streak_history (
          user_id, 
          streak_start_date, 
          streak_end_date, 
          streak_length
        ) VALUES (?, ?, DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), ?)
      `;
      await query(logHistoryQuery, [userId, streakInfo.streakStartDate, streakInfo.currentStreak]);
    }

    return {
      wasUpdated: true,
      currentStreak: streakInfo.currentStreak,
    };
  } catch (error) {
    logger.error(error, "[updateUserStreakQuery/error]");
    throw error;
  }
};

export const checkAndAwardBadgesQuery = async (userId, streakInfo, totalXP, taskType) => {
  try {
    // Get all badges for the specific task type (both earned and unearned)
    const getAllBadgesQuery = `
      SELECT 
        ab.id,
        ab.name,
        ab.description,
        ab.badge_type as badgeType,
        ab.requirements,
        ab.xp_reward as xpReward,
        ab.is_active as isActive,
        ab.task_type as taskType,
        ub.id as userBadgeId,
        ub.unlocked_at as unlockedAt
      FROM available_badges ab
      LEFT JOIN user_badges ub ON ab.id = ub.badge_id AND ub.user_id = ?
      WHERE ab.is_active = 1
      AND ab.task_type = ?
      ORDER BY ab.requirements
    `;
    const allBadges = await query(getAllBadgesQuery, [userId, taskType]);

    // Get stats based on task type
    let stats = {};

    if (taskType === "quiz") {
      const quizStatsQuery = `
        SELECT 
          COUNT(*) as totalQuizzes,
          SUM(CASE WHEN score >= 90 THEN 1 ELSE 0 END) as highScoreQuizzes
        FROM user_quiz_attempts
        WHERE user_id = ? AND status = 'completed'
      `;
      const [quizStats] = await query(quizStatsQuery, [userId]);
      stats = { ...quizStats };
    }

    if (taskType === "course_video") {
      const courseVideoStatsQuery = `
         SELECT COUNT(*) as totalVideos
          FROM user_chapter_progress
          WHERE user_id = ?
            AND is_completed = 1;`;
      const [courseVideoStats] = await query(courseVideoStatsQuery, [userId]);
      stats = { ...courseVideoStats };
    }

    // if (taskType === "course_video") {
    //   const speedStatsQuery = `
    //     SELECT COUNT(*) as fastCompletions
    //     FROM module_completions
    //     WHERE user_id = ? AND completion_time < avg_completion_time
    //   `;
    //   const [speedStats] = await query(speedStatsQuery, [userId]);
    //   stats = { ...speedStats };
    // }

    // Group badges by requirement type to handle milestones
    logger.debug(allBadges, "[checkAndAwardBadgesQuery/allBadges]");
    const badgeGroups = {};
    allBadges.forEach((badge) => {
      const requirements = badge.requirements;
      const key = `${requirements.type}`;
      if (!badgeGroups[key]) {
        badgeGroups[key] = [];
      }
      badgeGroups[key].push(badge);
    });

    // Process each badge group for milestone progression using Promise.map
    const allAwardedBadges = await Promise.map(
      Object.entries(badgeGroups),
      async ([requirementType, badges]) => {
        // Sort badges by their requirement value (ascending for milestones)
        badges.sort((a, b) => {
          const reqA = a.requirements;
          const reqB = b.requirements;

          if (requirementType === "streak") {
            return (reqA.daysRequired || 0) - (reqB.daysRequired || 0);
          } else if (requirementType === "quiz_score") {
            return (reqA.quizzesRequired || 0) - (reqB.quizzesRequired || 0);
          } else if (requirementType === "speed") {
            return (reqA.fastModulesRequired || 0) - (reqB.fastModulesRequired || 0);
          } else if (requirementType === "course_video") {
            return (reqA.courseVideosRequired || 0) - (reqB.courseVideosRequired || 0);
          }
          return 0;
        });

        // Find all milestones that should be awarded for this requirement type using Promise.mapSeries
        // Using mapSeries to maintain order and collect all eligible badges
        const eligibleBadges = await Promise.mapSeries(badges, async (badge) => {
          // Skip if user already has this badge
          if (badge.userBadgeId) {
            return null;
          }

          const requirements = badge.requirements;
          let isEarned = false;

          // Check if requirements are met
          switch (taskType) {
            case "streak":
              if (requirements.type === "streak" && streakInfo) {
                isEarned = streakInfo.currentStreak >= requirements.daysRequired;
              }
              break;
            case "quiz":
              if (requirements.type === "quiz_score") {
                isEarned = stats.highScoreQuizzes >= requirements.quizzesRequired;
              }
              break;
            case "course_video":
              if (requirements.type === "course_video") {
                isEarned = stats.totalVideos >= requirements.courseVideosRequired;
              }
              break;
          }

          if (isEarned) {
            // Award this badge
            const awardBadgeQuery = `
              INSERT INTO user_badges (user_id, badge_id)
              VALUES (?, ?)
            `;
            await query(awardBadgeQuery, [userId, badge.id]);

            // Award XP if badge has reward
            // if (badge.xpReward > 0) {
            //   await createXPTransactionQuery(userId, null, badge.xpReward, "BADGE");
            //   await updateUserLevelInfoQuery(userId, badge.xpReward);
            // }

            const resultBadge = {
              id: badge.id,
              name: badge.name,
              description: badge.description,
              type: badge.badgeType,
              xpReward: badge.xpReward,
              milestone: requirements,
              taskType: badge.taskType,
              unlockedAt: new Date().toISOString(),
              requirementType: requirements.type,
            };

            return resultBadge;
          }

          // If milestone isn't earned, stop processing higher milestones for this type
          return isEarned ? null : "STOP";
        });

        // Filter out null values and stop indicators, return all awarded badges
        const awardedBadgesForType = eligibleBadges.filter((result) => result && result !== "STOP");
        return awardedBadgesForType;
      },
      { concurrency: 1 }
    );

    // Flatten all awarded badges from all requirement types
    const awardedBadges = allAwardedBadges.flat().filter((badge) => badge !== null);

    return awardedBadges;
  } catch (error) {
    logger.error(error, "[checkAndAwardBadgesQuery/error]");
    throw error;
  }
};

export const getOrgLeaderboardWithCurrentUser = async (userId, orgId) => {
  const queryString = `
    WITH ranked_users AS (
      SELECT 
        u.id AS userId,
        u.name AS name,
        u.enrolled_at AS createdAt,
        CAST(COALESCE(SUM(ush.xp_earned), 0) AS UNSIGNED) AS totalXP,
        RANK() OVER (
          ORDER BY 
            COALESCE(SUM(ush.xp_earned), 0) DESC,
            u.enrolled_at ASC
        ) AS rankOfUser
      FROM users u
      LEFT JOIN user_streak_history ush ON ush.user_id = u.id
      WHERE u.org_id = ?
      GROUP BY u.id
    )
    SELECT 
      userId, name, totalXP, rankOfUser,
      CASE WHEN userId = ? THEN TRUE ELSE FALSE END AS currentUser
    FROM ranked_users
    WHERE rankOfUser <= 10 OR userId = ?
    ORDER BY rankOfUser ASC;
  `;

  try {
    return await query(queryString, [orgId, userId, userId]);
  } catch (error) {
    logger.error(error, "[getOrgLeaderboardWithCurrentUser/error]");
    throw error;
  }
};
