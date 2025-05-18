import { query } from "../../../config/db.js";
import logger from "../../../config/logger.js";

export const findTemplateMappingForUserWithOrgQuery = async (
  userId,
  taskTemplateId
) => {
  logger.debug(
    userId,
    taskTemplateId,
    `data being received: [findTemplateMappingForUserWithOrgQuery]`
  );

  const queryString = `SELECT t.id AS taskId, t.task_name AS taskName, t.xp_points AS xpPoints, o.id AS orgId
  FROM users u
          INNER JOIN organizations o on u.org_id = o.id
          INNER JOIN organization_task_templates ott on o.id = ott.organization_id
          INNER JOIN task_templates t on ott.task_template_id = t.id
  WHERE u.id = ?
    AND t.id = ?
    AND t.is_active = 1
    AND ott.is_active = 1;`;

  try {
    const result = await query(queryString, [userId, taskTemplateId]);
    return result;
  } catch (err) {
    logger.error(
      err,
      `error being received: [findTemplateMappingForUserWithOrgQuery/error]`
    );
    throw err;
  }
};

export const markTaskCompletedForUserAgainstTask = async (
  userId,
  orgId,
  taskTemplateId,
  xpPoints
) => {
  logger.debug(
    userId,
    orgId,
    taskTemplateId,
    xpPoints,
    `data being received: [markTaskCompletedForUserAgainstTask/data]`
  );

  const queryString = `INSERT INTO user_completed_tasks (user_id, organization_id, task_template_id, xp_earned, completed_at, source)
  VALUES (?, ?, ?, ?, NOW(), ?);`;

  try {
    const result = await query(queryString, [
      userId,
      orgId,
      taskTemplateId,
      xpPoints,
      "system",
    ]);
    return result;
  } catch (err) {
    logger.error(
      err,
      `error being received: [markTaskCompletedForUserAgainstTask/error]`
    );
    throw err;
  }
};

const updateUserStreakCache = async (userId) => {
  try {
    const checkTodayStreakQuery = `
      SELECT streak_status AS status
      FROM user_streak_history
      WHERE user_id = ? AND streak_date = CURDATE()
      LIMIT 1;
    `;
    const [streakRow] = await query(checkTodayStreakQuery, [userId]);
    if (!streakRow || streakRow.status !== "completed") return;

    const getLastStreakQuery = `
      SELECT current_streak AS currentStreak, end_date AS endDate
      FROM user_ongoing_streaks
      WHERE user_id = ?
      LIMIT 1;
    `;
    const [existing] = await query(getLastStreakQuery, [userId]);

    const today = new Date().toISOString().split("T")[0];

    if (!existing) {
      await query(
        `INSERT INTO user_ongoing_streaks (user_id, current_streak, start_date, end_date) VALUES (?, ?, ?, ?)`,
        [userId, 1, today, today]
      );
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        existing.endDate?.toISOString?.().split("T")[0] ===
        yesterday.toISOString().split("T")[0];

      const newStreak = isYesterday ? existing.currentStreak + 1 : 1;
      const startDate = isYesterday ? existing.start_date : today;

      await query(
        `UPDATE user_ongoing_streaks SET current_streak = ?, start_date = ?, end_date = ?, last_updated = NOW() WHERE user_id = ?`,
        [newStreak, startDate, today, userId]
      );
    }
  } catch (err) {
    logger.error(err, "[updateUserStreakCache/error]");
    throw err;
  }
};

export const markTheStreakStatusForTodayQuery = async (userId) => {
  logger.debug(
    userId,
    `data being received: [markTheStreakStatusForTodayQuery]`
  );

  try {
    const taskCountQuery = `SELECT COUNT(*) AS taskCount, COALESCE(SUM(xp_earned), 0) AS totalXP
      FROM (
        SELECT task_template_id, MAX(xp_earned) AS xp_earned
        FROM user_completed_tasks
        WHERE user_id = ?
          AND DATE(completed_at) = CURDATE()
        GROUP BY task_template_id
      ) AS unqiueTasks;`;

    const taskAndXpResult = await query(taskCountQuery, [userId]);

    const currentStatus =
      taskAndXpResult[0].taskCount > 0 ? "completed" : "missed";
    const totalTasksCompleted = taskAndXpResult[0].taskCount ?? 0;
    const totalXp = taskAndXpResult[0].totalXP ?? 0;

    const existingStreakQuery = `SELECT tasks_completed as taskCompleted, streak_status as streakStatus, xp_earned as totalXpEarned FROM user_streak_history
      WHERE user_id = ? AND streak_date = CURDATE();`;

    const existingStreakQueryResult = await query(existingStreakQuery, [
      userId,
    ]);

    if (existingStreakQueryResult.length) {
      const currentStreakInfo = existingStreakQueryResult[0];

      if (
        currentStreakInfo.streakStatus !== currentStatus ||
        currentStreakInfo.taskCompleted !== totalTasksCompleted ||
        currentStreakInfo.totalXpEarned !== totalXp
      ) {
        const updateQueryForStreak = `UPDATE user_streak_history
          SET tasks_completed = ?, xp_earned = ?, streak_status = ?
          WHERE user_id = ? AND streak_date = CURDATE();`;
        await query(updateQueryForStreak, [
          totalTasksCompleted,
          totalXp,
          currentStatus,
          userId,
        ]);
        await updateUserStreakCache(userId);
      }
      return true;
    } else {
      const insertStreakInfoQuery = `INSERT INTO user_streak_history (user_id, streak_date, tasks_completed, xp_earned, streak_status)
        VALUES (?, CURDATE(), ?, ?, ?);`;

      await query(insertStreakInfoQuery, [
        userId,
        totalTasksCompleted,
        totalXp,
        currentStatus,
      ]);
      await updateUserStreakCache(userId);
    }
  } catch (error) {
    logger.error(
      error,
      `error being received: [markTaskCompletedForUserAgainstTask/error]`
    );
    throw error;
  }
};

export const checkIfUsersTaskIsAlreadyMarkedAsDone = async (userId) => {
  const queryString = `SELECT 1
  FROM user_completed_tasks
  WHERE user_id = ?
    AND DATE(completed_at) = CURDATE();`;

  try {
    const result = query(queryString, [userId]);
    logger.debug(
      result,
      `data being received: [checkIfUsersTaskIsAlreadyMarkedAsDone/result]`
    );
    return result?.length ? true : false;
  } catch (error) {
    logger.error(
      error,
      `error being received: [markTaskCompletedForUserAgainstTask/error]`
    );
    throw error;
  }
};

export const getCurrentStreakCount = async (userId) => {
  const queryString = `
    SELECT current_streak AS currentStreak
    FROM user_ongoing_streaks
    WHERE user_id = ?
    LIMIT 1;
  `;

  try {
    const [result] = await query(queryString, [userId]);
    return result?.currentStreak ?? 0;
  } catch (error) {
    logger.error(error, "[getCurrentStreakCount/error]");
    throw error;
  }
};

export const getXPBreakdownAndTotal = async (userId) => {
  const queryString = `
    SELECT SUM(xp_earned) AS totalXP
    FROM user_streak_history
    WHERE user_id = ?
  `;

  try {
    const result = await query(queryString, [userId]);
    return { totalXP: result[0]?.totalXP ?? 0 };
  } catch (error) {
    logger.error(error, "[getXPBreakdownAndTotal/error]");
    throw error;
  }
};

export const getWeeklyStreakStatus = async (userId) => {
  const orgQuery = `SELECT org_id AS orgId FROM users WHERE id = ? LIMIT 1`;

  const queryString = `
    WITH days_of_week AS (
      SELECT DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL weekday_idx DAY) AS streakDate
      FROM (
        SELECT 0 AS weekday_idx UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
        UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
      ) AS weekdays
    ),
    user_tasks AS (
      SELECT task_template_id
      FROM organization_task_templates
      WHERE organization_id = ?
    ),
    completed_tasks_this_week AS (
      SELECT DISTINCT DATE(completed_at) AS completedDate
      FROM user_completed_tasks
      WHERE user_id = ?
        AND task_template_id IN (SELECT task_template_id FROM user_tasks)
        AND completed_at BETWEEN DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
                            AND DATE_ADD(CURDATE(), INTERVAL (6 - WEEKDAY(CURDATE())) DAY)
    )
    SELECT 
      DATE_FORMAT(streakDate, '%d-%m-%Y') AS streakDate,
      DATE_FORMAT(streakDate, '%a') AS day,
      CASE 
        WHEN streakDate = CURDATE() THEN 'done'
        WHEN streakDate < CURDATE() AND streakDate IN (SELECT completedDate FROM completed_tasks_this_week)
          THEN 'done'
        WHEN streakDate < CURDATE() THEN 'not done'
        ELSE 'inactive'
      END AS status,
      CASE WHEN streakDate = CURDATE() THEN TRUE ELSE FALSE END AS isToday
    FROM days_of_week
    ORDER BY streakDate;`;

  try {
    const [orgResult] = await query(orgQuery, [userId]);
    const orgId = orgResult?.orgId;
    const result = await query(queryString, [orgId, userId]);
    return result;
  } catch (error) {
    logger.error(error, "[getWeeklyStreakStatus/error]");
    throw error;
  }
};

export const getMonthlyStreakCalendar = async (userId, month, year) => {
  const queryString = `
    SELECT
      streak_date AS streakDate,
      streak_status AS status
    FROM user_streak_history
    WHERE user_id = ?
      AND MONTH(streak_date) = ?
      AND YEAR(streak_date) = ?
  `;

  try {
    const result = await query(queryString, [userId, month, year]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const found = result.find(
        (row) => row.streakDate.toISOString().split("T")[0] === date
      );

      calendar.push({
        date,
        status: found ? found.status : "inactive",
      });
    }

    return calendar;
  } catch (error) {
    logger.error(error, "[getMonthlyStreakCalendar/error]");
    throw error;
  }
};

export const getDayTaskDetails = async (userId, date) => {
  const queryString = `
    SELECT 
      t.task_name AS taskName,
      uct.task_template_id AS taskTemplateId,
      uct.xp_earned AS xpEarned,
      TIME_FORMAT(uct.completed_at, '%H:%i') AS timeCompleted
    FROM user_completed_tasks uct
    JOIN task_templates t ON uct.task_template_id = t.id
    WHERE uct.user_id = ? AND DATE(uct.completed_at) = ?
  `;

  try {
    const result = await query(queryString, [userId, date]);
    return result;
  } catch (error) {
    logger.error(error, "[getDayTaskDetails/error]");
    throw error;
  }
};

export const getUserCreatedDate = async (userId) => {
  const queryString = `SELECT enrolled_at AS createdAt FROM users WHERE id = ? LIMIT 1`;
  try {
    const [result] = await query(queryString, [userId]);
    return result?.createdAt ? new Date(result.createdAt) : null;
  } catch (error) {
    logger.error(error, "[getUserCreatedDate/error]");
    throw error;
  }
};

export const getUserStreakStatusesForMonth = async (userId, month, year) => {
  const queryString = `
    SELECT streak_date AS streakDate, streak_status AS status
    FROM user_streak_history
    WHERE user_id = ?
      AND MONTH(streak_date) = ?
      AND YEAR(streak_date) = ?
  `;
  try {
    return await query(queryString, [userId, month, year]);
  } catch (error) {
    logger.error(error, "[getUserStreakStatusesForMonth/error]");
    throw error;
  }
};

// export const getTopUsersByXPInOrg = async (orgId) => {
//   logger.debug(orgId, `data being received: [getTopUsersByXPInOrg/details]`);
//   const queryString = `
//     SELECT u.id AS userId, u.name AS name, COALESCE(SUM(ush.xp_earned), 0) AS totalXP
//     FROM users u
//     LEFT JOIN user_streak_history ush ON u.id = ush.user_id
//     WHERE u.org_id = ?
//     GROUP BY u.id
//     ORDER BY totalXP DESC
//     LIMIT 10;
//   `;
//   try {
//     return await query(queryString, [orgId]);
//   } catch (error) {
//     logger.error(error, "[getTopUsersByXPInOrg/error]");
//     throw error;
//   }
// };

// export const getUserRankInOrg = async (userId, orgId) => {
//   const queryString = `
//     SELECT ush.user_id AS userId, RANK() OVER (ORDER BY SUM(ush.xp_earned) DESC) AS rankOfUser
//     FROM user_streak_history ush
//     INNER JOIN users u ON ush.user_id = u.id
//     WHERE u.org_id = ?
//     GROUP BY ush.user_id;
//   `;
//   try {
//     const result = await query(queryString, [orgId]);
//     logger.debug(result, `data being received: [getUserRankInOrg/result]`);
//     const user = result.find((row) => row.userId == userId);
//     return user?.rankOfUser ?? null;
//   } catch (error) {
//     logger.error(error, "[getUserRankInOrg/error]");
//     throw error;
//   }
// };

export const getUserOrgId = async (userId) => {
  try {
    const orgQuery = `SELECT org_id AS orgId FROM users WHERE id = ? LIMIT 1`;
    return await query(orgQuery, [userId]);
  } catch (error) {
    logger.error(error, "[getUserOrgId/error]");
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
        COALESCE(SUM(ush.xp_earned), 0) AS totalXP,
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
  }catch (error) {
    logger.error(error, "[getOrgLeaderboardWithCurrentUser/error]");
    throw error;
  }
};

export const getUserCompletedTaskDescriptionsToday = async (userId) => {
  const queryString = `
    SELECT tt.task_description AS description
    FROM user_completed_tasks uct
    JOIN task_templates tt ON tt.id = uct.task_template_id
    WHERE uct.user_id = ?
      AND DATE(uct.completed_at) = CURDATE();
  `;

  try {
    const result = await query(queryString, [userId]);
    return result.map(r => r.description);
  } catch (error) {
    logger.error(error, "[getUserCompletedTaskDescriptionsToday/error]");
    throw error;
  }
};

export const markStreakAnimationAsSeenQuery = async (userId) => {
  const queryString = `
    UPDATE user_streak_history
    SET animation_shown = 1
    WHERE user_id = ? AND streak_date = CURDATE() AND animation_shown = 0;
  `;

  try {
    await query(queryString, [userId]);
    return true;
  } catch (error) {
    logger.error(error, "[markStreakAnimationAsSeenQuery/error]");
    throw error;
  }
};

export const shouldShowStreakAnimationToday = async (userId) => {
  const queryString = `
    SELECT animation_shown AS shown
    FROM user_streak_history
    WHERE user_id = ? 
      AND streak_date = CURDATE() 
      AND streak_status = 'completed'
    LIMIT 1;
  `;

  try {
    const [result] = await query(queryString, [userId]);
    return result ? result.shown === 0 : false;
  } catch (error) {
    logger.error(error, "[shouldShowStreakAnimationToday/error]");
    throw error;
  }
};