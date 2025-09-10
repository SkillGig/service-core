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

export const checkDuplicateXPTransactionQuery = async (
  userId,
  taskTemplateId,
  additionalData = {}
) => {
  try {
    // Extract additional tracking data for duplicate checking
    const {
      roadmapCourseId = null,
      moduleWeek = null,
      courseSectionId = null,
      courseChapterId = null,
      quizId = null,
      projectId = null,
    } = additionalData;

    // Build dynamic WHERE conditions based on what data is provided
    let whereConditions = ["user_id = ?", "task_template_id = ?", 'source_type = "TASK"'];
    let queryParams = [userId, taskTemplateId];

    // Add conditions for each tracking field that has a value
    if (roadmapCourseId !== null) {
      whereConditions.push("roadmap_course_id = ?");
      queryParams.push(roadmapCourseId);
    } else {
      whereConditions.push("roadmap_course_id IS NULL");
    }

    if (moduleWeek !== null) {
      whereConditions.push("module_week = ?");
      queryParams.push(moduleWeek);
    } else {
      whereConditions.push("module_week IS NULL");
    }

    if (courseSectionId !== null) {
      whereConditions.push("course_section_id = ?");
      queryParams.push(courseSectionId);
    } else {
      whereConditions.push("course_section_id IS NULL");
    }

    if (courseChapterId !== null) {
      whereConditions.push("course_chapter_id = ?");
      queryParams.push(courseChapterId);
    } else {
      whereConditions.push("course_chapter_id IS NULL");
    }

    if (quizId !== null) {
      whereConditions.push("quiz_id = ?");
      queryParams.push(quizId);
    } else {
      whereConditions.push("quiz_id IS NULL");
    }

    if (projectId !== null) {
      whereConditions.push("project_id = ?");
      queryParams.push(projectId);
    } else {
      whereConditions.push("project_id IS NULL");
    }

    const queryString = `
      SELECT 
        id,
        xp_points as xpPoints,
        created_at as createdAt
      FROM xp_transactions 
      WHERE ${whereConditions.join(" AND ")}
      LIMIT 1
    `;

    const result = await query(queryString, queryParams);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(error, "[checkDuplicateXPTransactionQuery/error]");
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

export const getOrgLeaderboardWithCurrentUser = async (userId) => {
  // This query builds a leaderboard using the current total_xp from user_level_info
  // and ranks users within the same organisation as the provided userId.
  const queryString = `
    WITH ranked_users AS (
      SELECT
        u.id AS userId,
        u.name AS name,
        u.enrolled_at AS createdAt,
        CAST(COALESCE(uli.total_xp, 0) AS UNSIGNED) AS totalXP,
        RANK() OVER (
          ORDER BY CAST(COALESCE(uli.total_xp, 0) AS UNSIGNED) DESC,
                   u.enrolled_at ASC
        ) AS rankOfUser
      FROM users u
      LEFT JOIN user_level_info uli ON uli.user_id = u.id
      WHERE u.org_id = (
        SELECT org_id FROM users WHERE id = ?
      )
      GROUP BY u.id, u.name, u.enrolled_at, uli.total_xp
    )
    SELECT
      userId, name, totalXP, rankOfUser,
      CASE WHEN userId = ? THEN TRUE ELSE FALSE END AS currentUser
    FROM ranked_users
    WHERE rankOfUser <= 10 OR userId = ?
    ORDER BY rankOfUser ASC;
  `;

  try {
    return await query(queryString, [userId, userId, userId]);
  } catch (error) {
    logger.error(error, "[getOrgLeaderboardWithCurrentUser/error]");
    throw error;
  }
};

export const getWeeklyStreakSummaryQuery = async (userId) => {
  try {
    // Get user's current streak info and total XP
    const userInfoQuery = `
      SELECT 
        COALESCE(us.current_streak, 0) as currentStreak,
        COALESCE(uli.total_xp, 0) as totalXp
      FROM user_level_info uli
      LEFT JOIN user_streaks us ON us.user_id = uli.user_id
      WHERE uli.user_id = ?
      
      UNION ALL
      
      SELECT 
        COALESCE(us.current_streak, 0) as currentStreak,
        0 as totalXp
      FROM user_streaks us
      WHERE us.user_id = ? 
      AND NOT EXISTS (SELECT 1 FROM user_level_info WHERE user_id = ?)
    `;

    const userInfoResults = await query(userInfoQuery, [userId, userId, userId]);
    const userInfo = userInfoResults[0] || { currentStreak: 0, totalXp: 0 };

    // Get all streak activities from xp_transactions for current week
    // We'll look at xp_transactions created_at dates to determine activity
    const weeklyActivitiesQuery = `
      SELECT DISTINCT 
        DATE(created_at) as activityDate
      FROM xp_transactions
      WHERE user_id = ? 
      AND source_type = 'TASK'
      AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
      AND DATE(created_at) < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
      ORDER BY activityDate
    `;

    const weeklyActivities = await query(weeklyActivitiesQuery, [userId]);

    return {
      currentStreak: userInfo.currentStreak || 0,
      totalXp: userInfo.totalXp || 0,
      weeklyActivities: weeklyActivities.map((activity) => activity.activityDate),
    };
  } catch (error) {
    logger.error(error, "[getWeeklyStreakSummaryQuery/error]");
    throw error;
  }
};

export const getMonthlyStreakSummaryQuery = async (userId, month, year) => {
  try {
    // Get all activity dates for the specified month from xp_transactions
    const monthlyActivitiesQuery = `
      SELECT DISTINCT 
        DATE(created_at) as activityDate
      FROM xp_transactions
      WHERE user_id = ? 
      AND source_type = 'TASK'
      AND YEAR(created_at) = ?
      AND MONTH(created_at) = ?
      ORDER BY activityDate
    `;

    const monthlyActivities = await query(monthlyActivitiesQuery, [userId, year, month]);

    return {
      monthlyActivities: monthlyActivities.map((activity) => activity.activityDate),
    };
  } catch (error) {
    logger.error(error, "[getMonthlyStreakSummaryQuery/error]");
    throw error;
  }
};

export const getDayStreakBreakupQuery = async (userId, date) => {
  try {
    // Get all task transactions for the specific date with detailed information
    const dayTasksQuery = `
      SELECT 
        xt.id as transactionId,
        xt.xp_points as xpPoints,
        xt.created_at as completedAt,
        xt.roadmap_course_id as roadmapCourseId,
        xt.module_week as moduleWeek,
        xt.course_section_id as courseSectionId,
        xt.course_chapter_id as courseChapterId,
        xt.quiz_id as quizId,
        xt.project_id as projectId,
        tt.name as taskName,
        tt.task_type as taskType,
        tt.is_streak_eligible as isStreakEligible
      FROM xp_transactions xt
      INNER JOIN task_templates tt ON xt.task_template_id = tt.id
      WHERE xt.user_id = ?
      AND xt.source_type = 'TASK'
      AND DATE(xt.created_at) = ?
      AND tt.is_streak_eligible = 1
      ORDER BY xt.created_at ASC
    `;

    const dayTasks = await query(dayTasksQuery, [userId, date]);

    // For each task, get additional details based on task type
    const enrichedTasks = await Promise.map(
      dayTasks,
      async (task) => {
        const taskDetails = {
          transactionId: task.transactionId,
          xpPoints: task.xpPoints,
          completedAt: task.completedAt,
          taskName: task.taskName,
          taskType: task.taskType,
          courseName: null,
          chapterName: null,
          quizName: null,
          projectName: null,
        };

        try {
          // Get chapter information if courseChapterId exists
          if (task.courseChapterId) {
            const chapterQuery = `
              SELECT ch.title              AS chapterName,
                     c.title               AS courseName,
                     r.roadmap_name        AS roadmapName
               FROM user_chapter_progress ucp
                       JOIN chapters ch ON ucp.chapter_id = ch.id
                       JOIN roadmap_courses_mapping rcm ON ucp.roadmap_course_id = rcm.id
                       JOIN roadmaps r ON rcm.roadmap_id = r.id
                       JOIN courses c ON ucp.course_id = c.id
               WHERE ucp.id = ?;
            `;
            const [chapterInfo] = await query(chapterQuery, [task.courseChapterId]);
            if (chapterInfo) {
              taskDetails.courseName = chapterInfo.courseName;
              taskDetails.roadmapName = chapterInfo.roadmapName;
              taskDetails.chapterName = chapterInfo.chapterName;
            }
          }
          // still left for quiz and project id
        } catch (enrichmentError) {
          logger.error(
            enrichmentError,
            `[getDayStreakBreakupQuery/enrichment-error-${task.transactionId}]`
          );
          // Continue with basic task info even if enrichment fails
        }

        return taskDetails;
      },
      { concurrency: 3 } // Process multiple tasks in parallel but with limited concurrency
    );

    return {
      date,
      totalXpEarned: dayTasks.reduce((sum, task) => sum + task.xpPoints, 0),
      totalTasks: dayTasks.length,
      tasks: enrichedTasks,
    };
  } catch (error) {
    logger.error(error, "[getDayStreakBreakupQuery/error]");
    throw error;
  }
};

export const getStreakStatusQuery = async (userId) => {
  try {
    // Get user's current streak info and animation status
    const userStreakQuery = `
      SELECT 
        current_streak as currentStreak,
        animation_seen as animationSeen,
        last_activity_date as lastActivityDate
      FROM user_streaks
      WHERE user_id = ? AND created_at = CURDATE()
    `;

    const [userStreak] = await query(userStreakQuery, [userId]);

    // If no streak record exists, create one
    if (!userStreak) {
      return {
        currentStreak: 0,
        animationSeen: false,
        completedStreak: false,
        weeklyActivities: [],
        todayTasks: [],
      };
    }

    // Get weekly activities for the current week
    const weeklyActivitiesQuery = `
      SELECT DISTINCT 
        DATE(created_at) as activityDate
      FROM xp_transactions
      WHERE user_id = ? 
      AND source_type = 'TASK'
      AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
      AND DATE(created_at) < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
      ORDER BY activityDate
    `;

    const weeklyActivities = await query(weeklyActivitiesQuery, [userId]);

    // Get today's completed tasks
    const todayTasksQuery = `
      SELECT 
        xt.id as transactionId,
        xt.xp_points as xpPoints,
        xt.created_at as completedAt,
        xt.course_chapter_id as courseChapterId,
        xt.quiz_id as quizId,
        xt.project_id as projectId,
        tt.name as taskName,
        tt.task_type as taskType
      FROM xp_transactions xt
      INNER JOIN task_templates tt ON xt.task_template_id = tt.id
      WHERE xt.user_id = ?
      AND xt.source_type = 'TASK'
      AND DATE(xt.created_at) = CURRENT_DATE
      AND tt.is_streak_eligible = 1
      ORDER BY xt.created_at ASC
    `;

    const todayTasks = await query(todayTasksQuery, [userId]);

    // Enrich today's tasks with details
    const enrichedTodayTasks = await Promise.map(
      todayTasks,
      async (task) => {
        const taskDetails = {
          transactionId: task.transactionId,
          xpPoints: task.xpPoints,
          completedAt: task.completedAt,
          taskName: task.taskName,
          taskType: task.taskType,
          courseName: null,
          chapterName: null,
          quizName: null,
          projectName: null,
        };

        try {
          // Get chapter information if courseChapterId exists
          if (task.courseChapterId) {
            const chapterQuery = `
              SELECT ch.title AS chapterName,
                     c.title AS courseName,
                     r.roadmap_name AS roadmapName
               FROM user_chapter_progress ucp
                       JOIN chapters ch ON ucp.chapter_id = ch.id
                       JOIN roadmap_courses_mapping rcm ON ucp.roadmap_course_id = rcm.id
                       JOIN roadmaps r ON rcm.roadmap_id = r.id
                       JOIN courses c ON ucp.course_id = c.id
               WHERE ucp.id = ?
            `;
            const [chapterInfo] = await query(chapterQuery, [task.courseChapterId]);
            if (chapterInfo) {
              taskDetails.courseName = chapterInfo.courseName;
              taskDetails.roadmapName = chapterInfo.roadmapName;
              taskDetails.chapterName = chapterInfo.chapterName;
            }
          }
        } catch (enrichmentError) {
          logger.error(
            enrichmentError,
            `[getStreakStatusQuery/enrichment-error-${task.transactionId}]`
          );
        }

        return taskDetails;
      },
      { concurrency: 3 }
    );

    return {
      currentStreak: userStreak.currentStreak || 0,
      animationSeen: userStreak.animationSeen === 1,
      weeklyActivities: weeklyActivities.map((activity) => activity.activityDate),
      todayTasks: enrichedTodayTasks,
      completedStreak: enrichedTodayTasks.length > 0,
    };
  } catch (error) {
    logger.error(error, "[getStreakStatusQuery/error]");
    throw error;
  }
};

export const markAnimationSeenQuery = async (userId) => {
  try {
    const updateQuery = `
      UPDATE user_streaks 
      SET animation_seen = 1
      WHERE user_id = ?
    `;

    await query(updateQuery, [userId]);
    return true;
  } catch (error) {
    logger.error(error, "[markAnimationSeenQuery/error]");
    throw error;
  }
};

export const checkDailyLoginQuery = async (userId) => {
  try {
    // Check if user has already logged in today by checking for daily_login XP transactions
    const dailyLoginCheckQuery = `
      SELECT 
        xt.id as transactionId,
        xt.xp_points as xpPoints,
        xt.created_at as loginTime,
        tt.name as taskName
      FROM xp_transactions xt
      INNER JOIN task_templates tt ON xt.task_template_id = tt.id
      WHERE xt.user_id = ?
      AND xt.source_type = 'TASK'
      AND tt.task_type = 'daily_login'
      AND DATE(xt.created_at) = CURRENT_DATE
      LIMIT 1
    `;

    const existingLogin = await query(dailyLoginCheckQuery, [userId]);
    return existingLogin.length > 0 ? existingLogin[0] : null;
  } catch (error) {
    logger.error(error, "[checkDailyLoginQuery/error]");
    throw error;
  }
};

export const getDailyLoginTaskTemplateQuery = async () => {
  try {
    // Get the daily login task template
    const taskTemplateQuery = `
      SELECT 
        id, 
        name, 
        xp_points as xpPoints, 
        is_streak_eligible as isStreakEligible,
        is_active as isActive,
        task_type as taskType
      FROM task_templates 
      WHERE task_type = 'daily_login' 
      AND is_active = 1
      LIMIT 1
    `;

    const result = await query(taskTemplateQuery);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(error, "[getDailyLoginTaskTemplateQuery/error]");
    throw error;
  }
};

export const getUserAchievementsQuery = async (userId) => {
  try {
    // Get user's current level and XP information
    const userLevelQuery = `
      SELECT 
        uli.total_xp as totalXp,
        uli.current_level_id as currentLevelId,
        l.id as levelId,
        l.level_name as levelName,
        l.tier,
        l.tier_level as tierLevel,
        l.min_xp_required as minXpRequired,
        l.max_xp_required as maxXpRequired
      FROM user_level_info uli
      LEFT JOIN levels l ON uli.current_level_id = l.id
      WHERE uli.user_id = ?
    `;

    const [userLevel] = await query(userLevelQuery, [userId]);

    // Get next level information for progress calculation
    let nextLevel = null;
    if (userLevel && userLevel.totalXp !== null) {
      const nextLevelQuery = `
        SELECT 
          id,
          level_name as levelName,
          tier,
          tier_level as tierLevel,
          min_xp_required as minXpRequired,
          max_xp_required as maxXpRequired
        FROM levels 
        WHERE min_xp_required > ? 
        AND is_active = 1
        ORDER BY min_xp_required ASC 
        LIMIT 1
      `;

      const nextLevelResult = await query(nextLevelQuery, [userLevel.totalXp || 0]);

      if (nextLevelResult.length > 0) {
        nextLevel = nextLevelResult[0];
      }
    }

    // Get user's earned badges with their levels and details
    const userBadgesQuery = `
      SELECT 
        ub.id as userBadgeId,
        ub.badge_id as badgeId,
        ub.unlocked_at as unlockedAt,
        ab.name as badgeName,
        ab.description as badgeDescription,
        ab.badge_type as badgeType,
        ab.requirements,
        ab.xp_reward as xpReward,
        ab.is_global as isGlobal,
        ab.is_active as isActive
      FROM user_badges ub
      INNER JOIN available_badges ab ON ub.badge_id = ab.id
      WHERE ub.user_id = ?
      ORDER BY ub.unlocked_at DESC, ab.name ASC
    `;

    const userBadges = await query(userBadgesQuery, [userId]);

    // Calculate progress to next level
    let progressToNextLevel = null;
    if (userLevel && nextLevel) {
      const currentXP = userLevel.totalXp || 0;
      const currentLevelMinXP = userLevel.minXpRequired || 0;
      const currentLevelMaxXP = userLevel.maxXpRequired || 0;
      const nextLevelMinXP = nextLevel.minXpRequired;
      const xpNeededForNext = nextLevelMinXP - currentXP;

      // Calculate progress within current level range
      const progressXP = currentXP - currentLevelMinXP;
      const levelRange = currentLevelMaxXP - currentLevelMinXP;
      const progressPercentage =
        levelRange > 0 ? Math.min(Math.max((progressXP / levelRange) * 100, 0), 100) : 0;

      progressToNextLevel = {
        currentXP,
        nextLevelXP: nextLevelMinXP,
        xpNeededForNext,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        nextLevel: {
          id: nextLevel.id,
          levelName: nextLevel.levelName,
          tier: nextLevel.tier,
          tierLevel: nextLevel.tierLevel,
          minXpRequired: nextLevel.minXpRequired,
          maxXpRequired: nextLevel.maxXpRequired,
        },
      };
    }

    return {
      userLevel: userLevel || null,
      progressToNextLevel,
      userBadges: userBadges || [],
    };
  } catch (error) {
    logger.error(error, "[getUserAchievementsQuery/error]");
    throw error;
  }
};
