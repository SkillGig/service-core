import { query, queryWithConn } from "../../../config/db.js";
import logger from "../../../config/logger.js";
import Bluebird from "bluebird";
const Promise = Bluebird;

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

export const fetchUserNotificationsPaginated = async (userId, page = 1, limit = 10) => {
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
    oec.branding_message AS brandingMessage,
    ob.branch_name AS branchName,
    si.start_date AS userStartDate,
    si.end_date AS userEndDate
    FROM users u
            INNER JOIN organizations o ON u.org_id = o.id
            INNER JOIN org_extra_configs oec ON o.id = oec.org_id
            INNER JOIN student_info si ON u.student_id = si.id
            INNER JOIN org_branches ob ON si.branch_id = ob.id
    WHERE u.id = ? AND o.is_active = 1;`;
  try {
    const result = await query(queryString, [userId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [userDetailsQuery/error]`);
    throw error;
  }
};

export const setUserRoadmapQuery = async (userId, roadmapId, conn) => {
  logger.debug(userId, `data being received: [setUserRoadmapQuery]`);
  const queryString = `
    INSERT INTO user_enrolled_roadmaps (user_id, roadmap_id)
    VALUES (?, ?)
  `;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [userId, roadmapId]);
    }
    return await query(queryString, [userId, roadmapId]);
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

export const getRoadmapDetailsQuery = async (roadmapId) => {
  logger.debug(roadmapId, `data being received: [getRoadmapDetailsQuery]`);

  const queryString = `SELECT
      r.id AS roadmap_id,
      r.roadmap_name,
      c.id AS course_id,
      c.title AS course_title,
      c.thumbnail_url,
      c.level,
      t.name AS tutor_name,
      GROUP_CONCAT(DISTINCT tag.title) AS tags,
      AVG(cr.rating) AS rating,
      COUNT(DISTINCT ucp.id) AS enrolled_count
    FROM roadmaps r
    JOIN roadmap_courses_mapping rcm ON rcm.roadmap_id = r.id
    JOIN courses c ON c.id = rcm.course_id
    JOIN tutors t ON t.id = c.tutor_id
    LEFT JOIN course_tags ct ON ct.course_id = c.id
    LEFT JOIN tags tag on ct.tag_id = tag.id
    LEFT JOIN course_reviews cr ON cr.course_id = c.id
    LEFT JOIN user_course_progress ucp ON ucp.roadmap_course_id = rcm.id
    WHERE r.id = ?
      AND r.is_active = 1
      AND c.is_active = 1
    GROUP BY c.id
    ORDER BY rcm.order, c.level;`;

  try {
    const result = await query(queryString, [roadmapId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getRoadmapDetailsQuery/error]`);
    throw error;
  }
};

export const getAllRoadmapsAvailableForUserToEnroll = async (orgId) => {
  logger.debug(orgId, `data being received: [getAllRoadmapsAvailableForUserToEnroll]`);

  const queryString = `
    SELECT r.id AS roadmapId, r.roadmap_name AS roadmapName FROM org_roadmap_mapping orm
    INNER JOIN roadmaps r ON orm.roadmap_id = r.id
    WHERE orm.org_id = ? AND r.is_active = 1 AND orm.is_enabled = 1;
  `;

  try {
    return await query(queryString, [orgId]);
  } catch (error) {
    logger.error(error, `error being received: [getAllRoadmapsAvailableForUserToEnroll/error]`);
    throw error;
  }
};

export const getCourseDetailsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseDetailsQuery]`);

  const queryString = `
    SELECT id AS courseId, title AS courseTitle, description AS courseDescription, thumbnail_url AS imageUrl, tutor_id AS tutorId FROM courses WHERE id = ?;`;
  try {
    const result = await query(queryString, [courseId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getCourseDetailsQuery/error]`);
    throw error;
  }
};

export const getTutorDetailsQuery = async (tutorId) => {
  logger.debug(tutorId, `data being received: [getTutorDetailsQuery]`);

  const queryString = `
    SELECT id AS tutorId, name AS tutorName, description AS tutorBio, profile_picture AS profileImageUrl
    FROM tutors WHERE id = ?;`;
  try {
    const result = await query(queryString, [tutorId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getTutorDetailsQuery/error]`);
    throw error;
  }
};

export const getCourseTagsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseTagsQuery]`);

  const queryString = `
    SELECT t.id AS tagId, t.title AS tagTitle
    FROM course_tags ct
    INNER JOIN tags t ON ct.tag_id = t.id
    WHERE ct.course_id = ?;`;
  try {
    const result = await query(queryString, [courseId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getCourseTagsQuery/error]`);
    throw error;
  }
};

export const getCourseLearningsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseLearningsQuery]`);

  const queryString = `
    SELECT id AS learningId, title AS learningTitle, description AS learningDescription
    FROM course_learnings WHERE course_id = ? AND is_active = 1 ORDER BY display_order;`;
  try {
    const result = await query(queryString, [courseId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getCourseLearningsQuery/error]`);
    throw error;
  }
};

export const getCourseReviewsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseReviewsQuery]`);

  const queryString = `
    SELECT cr.id AS reviewId, cr.rating AS rating, cr.review AS review, cr.created_at AS createdAt,
           u.name AS reviewerName
    FROM course_reviews cr
    INNER JOIN users u ON cr.user_id = u.id
    WHERE cr.course_id = ? AND cr.is_active = 1
    ORDER BY cr.created_at DESC;`;
  try {
    const result = await query(queryString, [courseId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getCourseReviewsQuery/error]`);
    throw error;
  }
};

export const getCourseModulesQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseModulesQuery]`);

  const courseSummaryQueryString = `SELECT COUNT(DISTINCT s.module_week) AS totalModules,
       COUNT(DISTINCT s.id)                                          AS totalSection,
       COUNT(DISTINCT ch.id)                                         AS totalChapters,
       SUM(CASE WHEN ch.content_type = 'video' THEN 1 ELSE 0 END)    AS totalVideos,
       SUM(CASE WHEN ch.content_type = 'document' THEN 1 ELSE 0 END) AS totalDocs,
       SUM(CASE WHEN ch.content_type = 'quiz' THEN 1 ELSE 0 END)     AS totalQuizzes,
       SUM(CASE WHEN ch.content_type = 'project' THEN 1 ELSE 0 END)  AS totalProjects,
       SUM(ch.content_duration)                                      AS courseDuration
    FROM sections s
            JOIN chapters ch ON ch.section_id = s.id
    WHERE s.course_id = ?
      AND s.is_active = 1
      AND ch.is_active = 1;`;

  const courseDetailsQueryString = `
    SELECT
      s.module_week,
      s.id AS sectionId,
      s.title AS sectionTitle,
      s.description AS sectionDescription,
      s.display_order AS sectionOrder,
      ch.content_duration AS sectionDuration,
      ch.id AS chapterId,
      ch.title AS chapterTitle,
      ch.content_type as contentType,
      ch.content_duration AS chapterDuration,
      qm.id as quizMappingId,
      q.title as quizTitle,
      q.description as quizDescription,
      pm.id as projectMappingId,
      p.title as projectTitle,
      p.description as projectDescription
    FROM sections s
    JOIN chapters ch ON ch.section_id = s.id
    LEFT JOIN quiz_mapping qm ON ch.content_type = 'quiz' AND ch.content_ref_id = qm.id
    LEFT JOIN quizzes q ON ch.content_type = 'quiz' AND qm.quiz_id = q.id
    LEFT JOIN projects_mapping pm ON ch.content_type = 'project' AND ch.content_ref_id = pm.id
    LEFT JOIN projects p ON ch.content_type = 'project' AND pm.project_id = p.id
    WHERE s.course_id = ? AND s.is_active = 1 AND ch.is_active = 1
    GROUP BY s.module_week, s.id, ch.id
    ORDER BY s.module_week, s.display_order, ch.display_order;`;
  try {
    const [summaryResult, detailsResult] = await Promise.all([
      query(courseSummaryQueryString, [courseId]),
      query(courseDetailsQueryString, [courseId]),
    ]);
    return {
      summary: summaryResult[0] || {},
      details: detailsResult || [],
    };
  } catch (error) {
    logger.error(error, `error being received: [getCourseModulesQuery/error]`);
    throw error;
  }
};

export const getAllRoadmapsEnrolledByUserQuery = async (userId) => {
  logger.debug(userId, `data being received: [getAllRoadmapsEnrolledByUserQuery]`);

  const queryString = `
    SELECT r.id AS roadmapId, r.roadmap_name AS roadmapName, r.roadmap_description AS roadmapDescription 
    FROM user_enrolled_roadmaps uer
    INNER JOIN roadmaps r ON uer.roadmap_id = r.id
    WHERE uer.user_id = ? AND r.is_active = 1;`;

  try {
    const result = await query(queryString, [userId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getAllRoadmapsEnrolledByUserQuery/error]`);
    throw error;
  }
};

export const checkUserOrgMultipleRoadmapsEnrollmentQuery = async (userId) => {
  logger.debug(userId, `data being received: [checkUserOrgMultipleRoadmapsEnrollmentQuery]`);

  const queryString = `
    SELECT oec.allow_multiple_roadmaps AS allowMultipleRoadmaps
    FROM users u
    INNER JOIN organizations o ON u.org_id = o.id
    INNER JOIN org_extra_configs oec ON o.id = oec.org_id
    WHERE u.id = ?;`;

  try {
    const result = await query(queryString, [userId]);
    return result.length ? result[0].allowMultipleRoadmaps : false;
  } catch (error) {
    logger.error(
      error,
      `error being received: [checkUserOrgMultipleRoadmapsEnrollmentQuery/error]`
    );
    throw error;
  }
};

export const getAllCoursesMappedUnderRoadmapQuery = async (roadmapId, conn) => {
  logger.debug(roadmapId, `data being received: [getAllCoursesMappedUnderRoadmapQuery]`);
  const queryString = `SELECT rcm.id AS roadmapCourseId,
            r.roadmap_name AS roadmapName,
            rcm.roadmap_id AS roadmapId,
            rcm.course_id AS courseId,
            rcm.is_mandatory_to_proceed AS isMandatory,
            rcm.weekly_unlock AS weeklyUnlock,
            rcm.order AS courseOrder,
            rcm.prerequisite_course_id AS preRequisiteCourseId
    FROM roadmap_courses_mapping rcm
    INNER JOIN roadmaps r ON rcm.roadmap_id = r.id
    INNER JOIN courses c ON rcm.course_id = c.id
    INNER JOIN tutors t ON c.tutor_id = t.id
    WHERE rcm.roadmap_id = ? AND rcm.is_active = 1 AND c.is_active = 1 ORDER By rcm.order;`;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [roadmapId]);
    }
    return await query(queryString, [roadmapId]);
  } catch (error) {
    logger.error(error, `error being received: [getAllCoursesMappedUnderRoadmapQuery/error]`);
    throw error;
  }
};

export const checkIfCourseIsAlreadyEnrolledToCourseQuery = async (
  userId,
  roadmapCourseId,
  conn
) => {
  const queryString = `SELECT ucp.id AS userProgressId
    FROM user_course_progress ucp
    WHERE ucp.user_id = ? AND ucp.roadmap_course_id = ?;`;
  try {
    if (conn) {
      const result = await queryWithConn(conn, queryString, [userId, roadmapCourseId]);
      return result.length > 0;
    }
    const result = await query(queryString, [userId, roadmapCourseId]);
    return result.length > 0;
  } catch (error) {
    logger.error(error, `[checkIfCourseIsAlreadyEnrolledToCourseQuery]`);
    throw error;
  }
};

export const insertUserCourseProgressQuery = async (
  userId,
  roadmapCourseId,
  courseId,
  totalModules,
  userRoadmapId,
  conn
) => {
  const queryString = `INSERT INTO user_course_progress (user_id, roadmap_course_id, course_id, user_enrolled_roadmap_id, total_modules, completed_modules, progress_percent)
    VALUES (?, ?, ?, ?, ?, 0, 0)
    ON DUPLICATE KEY UPDATE total_modules = ?, updated_at = NOW();`;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [
        userId,
        roadmapCourseId,
        courseId,
        userRoadmapId,
        totalModules,
        totalModules,
      ]);
    }
    return await query(queryString, [
      userId,
      roadmapCourseId,
      courseId,
      userRoadmapId,
      totalModules,
      totalModules,
    ]);
  } catch (error) {
    logger.error(error, `[insertUserCourseProgressQuery]`);
    throw error;
  }
};

export const getAllSectionsUnderCourseQuery = async (courseId, conn) => {
  const queryString = `SELECT id AS sectionId, title AS sectionTitle, description AS sectionDescription, display_order AS sectionOrder,
    module_week AS moduleWeek
  FROM sections WHERE course_id = ? AND is_active = 1 ORDER BY display_order;`;

  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [courseId]);
    }
    return await query(queryString, [courseId]);
  } catch (error) {
    logger.error(error, `[getAllSectionsUnderCourseQuery]`);
    throw error;
  }
};

export const getAllChaptersUnderSectionQuery = async (sectionId, conn) => {
  const queryString = `SELECT id AS chapterId, title AS chapterTitle, content_type AS contentType, content_duration AS chapterDuration,  content_ref_id as contentRefId, display_order AS chapterOrder
    FROM chapters WHERE section_id = ? AND is_active = 1 ORDER BY display_order;`;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [sectionId]);
    }
    return await query(queryString, [sectionId]);
  } catch (error) {
    logger.error(error, `[getAllChaptersUnderSectionQuery]`);
    throw error;
  }
};

export const insertIntoUserSectionProgressQuery = async (
  userId,
  roadmapCourseId,
  courseId,
  sectionId,
  isUnlocked,
  totalChapters,
  userCourseProgressId,
  moduleWeek,
  conn
) => {
  logger.debug(
    userId,
    `data being received: [insertIntoUserSectionProgressQuery
]`
  );
  const queryString = `
    INSERT INTO user_section_progress (
      user_id, roadmap_course_id, course_id, user_enrolled_course_progress_id, section_id, module_week, total_chapters, is_unlocked, unlocked_at, is_completed
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 1, NOW(), NULL), 0
    )
    ON DUPLICATE KEY UPDATE
      is_unlocked = VALUES(is_unlocked),
      updated_at = NOW();
  `;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [
        userId,
        roadmapCourseId,
        courseId,
        userCourseProgressId,
        sectionId,
        moduleWeek,
        totalChapters,
        isUnlocked,
        isUnlocked,
      ]);
    }
    return await query(queryString, [
      userId,
      roadmapCourseId,
      courseId,
      userCourseProgressId,
      sectionId,
      moduleWeek,
      totalChapters,
      isUnlocked,
      isUnlocked,
    ]);
  } catch (error) {
    logger.error(error, `[insertIntoUserSectionProgressQuery]`);
    throw error;
  }
};

export const insertIntoUserChapterProgressQuery = async (
  userId,
  roadmapCourseId,
  courseId,
  sectionId,
  chapterId,
  isUnlocked,
  totalDuration,
  contentType = "video",
  quizMappingId = null,
  projectMappingId = null,
  sectionProgressId,
  conn
) => {
  logger.debug(
    chapterId,
    isUnlocked,
    `data being received: [insertIntoUserChapterProgressQuery/data]`
  );
  const queryString = `
    INSERT INTO user_chapter_progress (
      user_id, roadmap_course_id, course_id, section_id, user_enrolled_section_progress_id, chapter_id, total_duration, is_unlocked, unlocked_at, content_type, content_ref_id, is_completed
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 1, NOW(), NULL), ?, ?, 0
    );
  `;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [
        userId,
        roadmapCourseId,
        courseId,
        sectionId,
        sectionProgressId,
        chapterId,
        totalDuration,
        isUnlocked,
        isUnlocked, // for unlocked_at IF(? = 1, NOW(), NULL)
        contentType,
        contentType === "quiz" ? quizMappingId : projectMappingId,
      ]);
    }
    return await query(queryString, [
      userId,
      roadmapCourseId,
      courseId,
      sectionId,
      sectionProgressId,
      chapterId,
      totalDuration,
      isUnlocked,
      isUnlocked, // for unlocked_at IF(? = 1, NOW(), NULL)
      contentType,
      contentType === "quiz" ? quizMappingId : projectMappingId,
    ]);
  } catch (error) {
    logger.error(error, `[insertIntoUserChapterProgressQuery]`);
    throw error;
  }
};

export const getQuizDetailsQuery = async (quizMappingId) => {
  logger.debug(quizMappingId, `data being received: [getQuizDetailsQuery]`);

  const queryString = `
    SELECT qm.id as quizMappingId, q.id AS quizId, q.title AS quizTitle, q.description AS quizDescription, q.is_active AS isActive
    FROM quiz_mapping qm
    INNER JOIN quizzes q ON qm.quiz_id = q.id
    WHERE qm.id = ? AND qm.is_active = 1;`;

  try {
    const result = await query(queryString, [quizMappingId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getQuizDetailsQuery/error]`);
    throw error;
  }
};

export const getProjectDetailsQuery = async (projectMappingId) => {
  logger.debug(projectMappingId, `data being received: [getProjectDetailsQuery]`);

  const queryString = `
    SELECT pm.id as projectMappingId, p.id AS projectId, p.title AS projectTitle, p.description AS projectDescription, p.is_active AS isActive, p.instructions AS projectInstructions, p.required_format AS requiredFormat
    FROM projects_mapping pm
    INNER JOIN projects p ON pm.project_id = p.id
    WHERE pm.id = ?;`;

  try {
    const result = await query(queryString, [projectMappingId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getProjectDetailsQuery/error]`);
    throw error;
  }
};

export const getPrerequisiteCourseQuery = async (roadmapCourseId) => {
  logger.debug(roadmapCourseId, `data being received: [getPrerequisiteCourseQuery]`);

  const queryString = `
    SELECT rcm.prerequisite_course_id AS prerequisiteCourseId,
       rcm.roadmap_id             AS roadmapId,
       rcm.weekly_unlock          AS isWeeklyUnlock
    FROM roadmap_courses_mapping rcm
            INNER JOIN courses c ON rcm.prerequisite_course_id = c.id
    WHERE rcm.id = ?;`;

  try {
    const result = await query(queryString, [roadmapCourseId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getPrerequisiteCourseQuery/error]`);
    throw error;
  }
};

export const getAllModuleDetailsQuery = async (roadmapCourseId, userId, conn) => {
  logger.debug(roadmapCourseId, userId, `data being received: [getAllModuleDetailsQuery]`);

  const queryString = `SELECT ucp.course_id as courseId,
       usp.section_id   as sectionId,
       usp.user_enrolled_course_progress_id as userEnrolledCourseId,
       usp.module_week  as moduleWeek,
       usp.is_unlocked  as isSectionUnlocked,
       usp.is_completed as isSectionCompleted,
       usp.completed_at as sectionCompletedAt,
       usp.unlocked_at  as sectionUnlockedAt
  FROM user_course_progress ucp
          INNER JOIN user_section_progress usp ON ucp.id = usp.user_enrolled_course_progress_id
  WHERE ucp.roadmap_course_id = ? AND ucp.user_id = ? ORDER BY usp.section_id;`;

  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [roadmapCourseId, userId]);
    }
    return await query(queryString, [roadmapCourseId, userId]);
  } catch (error) {
    logger.error(error, `error being received: [getAllModuleDetailsQuery/error]`);
    throw error;
  }
};

export const getPreviousSectionStatusQuery = async (userId, roadmapCourseId, sectionId, conn) => {
  logger.debug(
    userId,
    roadmapCourseId,
    sectionId,
    `data being received: [getPreviousSectionStatusQuery]`
  );

  const queryString = `SELECT section_id AS sectionId, is_completed AS isCompleted, is_unlocked AS isUnlocked, unlocked_at AS unlockedAt, completed_at AS completedAt
    FROM user_section_progress
    WHERE user_id = ?
    AND roadmap_course_id = ?
    AND section_id < ?;`;

  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [userId, roadmapCourseId, sectionId]);
    }
    return await query(queryString, [userId, roadmapCourseId, sectionId]);
  } catch (error) {
    logger.error(error, `error being received: [getPreviousSectionStatusQuery/error]`);
    throw error;
  }
};

export const getAllChaptersUnderSectionForUserQuery = async (
  userId,
  roadmapCourseId,
  sectionId,
  conn
) => {
  logger.debug(
    userId,
    roadmapCourseId,
    sectionId,
    `data being received: [getAllChaptersUnderSectionForUserQuery]`
  );

  const queryString = `SELECT chapter_id AS chapterId, is_unlocked AS isChapterUnlocked, is_completed AS isChapterCompleted
    FROM user_chapter_progress
    WHERE user_id = ? AND roadmap_course_id = ? AND section_id = ?;`;

  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [userId, roadmapCourseId, sectionId]);
    }
    return await query(queryString, [userId, roadmapCourseId, sectionId]);
  } catch (error) {
    logger.error(error, `error being received: [getAllChaptersUnderSectionForUserQuery/error]`);
    throw error;
  }
};

export const markUnlockSectionToUserQuery = async ({
  userId,
  roadmapCourseId,
  sectionId,
  isUnlocked,
  conn,
}) => {
  logger.debug(
    userId,
    roadmapCourseId,
    sectionId,
    isUnlocked,
    `data being received: [markUnlockSectionToUserQuery]`
  );
  const queryString = `
    UPDATE user_section_progress
    SET is_unlocked = ?, updated_at = NOW(), unlocked_at = NOW()
    WHERE user_id = ? AND roadmap_course_id = ? AND section_id = ?;`;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [
        isUnlocked,
        userId,
        roadmapCourseId,
        sectionId,
      ]);
    }
    return await query(queryString, [isUnlocked, userId, roadmapCourseId, sectionId]);
  } catch (error) {
    logger.error(error, `[markUnlockSectionToUserQuery]`);
    throw error;
  }
};

export const markUnlockChapterToUserQuery = async ({
  userId,
  roadmapCourseId,
  sectionId,
  chapterId,
  isUnlocked,
  conn,
}) => {
  logger.debug(
    userId,
    roadmapCourseId,
    sectionId,
    chapterId,
    isUnlocked,
    `data being received: [markUnlockChapterToUserQuery]`
  );
  const queryString = `
    UPDATE user_chapter_progress
    SET is_unlocked = ?, updated_at = NOW(), unlocked_at = NOW()
    WHERE user_id = ? AND roadmap_course_id = ? AND section_id = ? AND chapter_id = ?;`;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [
        isUnlocked,
        userId,
        roadmapCourseId,
        sectionId,
        chapterId,
      ]);
    }
    return await query(queryString, [isUnlocked, userId, roadmapCourseId, sectionId, chapterId]);
  } catch (error) {
    logger.error(error, `[markUnlockChapterToUserQuery]`);
    throw error;
  }
};

export const getPreviousChapterStatusQuery = async (userId, roadmapCourseId, chapterId, conn) => {
  logger.debug(
    userId,
    roadmapCourseId,
    chapterId,
    `data being received: [getPreviousChapterStatusQuery]`
  );

  const queryString = `SELECT chapter_id AS chapterId, is_completed AS isChapterCompleted, is_unlocked AS isChapterUnlocked
    FROM user_chapter_progress
    WHERE user_id = ?
    AND roadmap_course_id = ?
    AND chapter_id < ?;`;

  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [userId, roadmapCourseId, chapterId]);
    }
    return await query(queryString, [userId, roadmapCourseId, chapterId]);
  } catch (error) {
    logger.error(error, `error being received: [getPreviousChapterStatusQuery/error]`);
    throw error;
  }
};

export const getCourseMappingDetailsQuery = async (roadmapCourseId, conn) => {
  logger.debug(roadmapCourseId, `data being received: [getCourseMappingDetailsQuery]`);

  const queryString = `
    SELECT rcm.id AS roadmapCourseId, rcm.roadmap_id AS roadmapId, rcm.course_id AS courseId,
           rcm.is_mandatory_to_proceed AS isMandatory, rcm.weekly_unlock AS isWeeklyUnlock,
           rcm.order AS courseOrder, rcm.prerequisite_course_id AS preRequisiteCourseId
    FROM roadmap_courses_mapping rcm
    WHERE rcm.id = ?;`;

  try {
    if (conn) {
      const result = await queryWithConn(conn, queryString, [roadmapCourseId]);
      return result.length ? result[0] : null;
    }
    const result = await query(queryString, [roadmapCourseId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getCourseMappingDetailsQuery/error]`);
    throw error;
  }
};

export const getUserCourseCompletionStatusQuery = async (userId, roadmapId, courseId, conn) => {
  logger.debug(userId, roadmapId, `data being received: [getUserCourseCompletionStatusQuery]`);

  const queryString = `
    SELECT ucp.total_modules AS totalModules,
           ucp.completed_modules AS completedModules, ucp.progress_percent AS progressPercent, ucp.is_completed AS isCompleted
    FROM user_course_progress ucp
    INNER JOIN roadmap_courses_mapping rcm ON ucp.roadmap_course_id = rcm.id
    WHERE ucp.user_id = ? AND rcm.roadmap_id = ? AND rcm.course_id = ?;`;

  try {
    if (conn) {
      const result = await queryWithConn(conn, queryString, [userId, roadmapId, courseId]);
      return result.length ? result[0] : null;
    }
    const result = await query(queryString, [userId, roadmapId, courseId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getUserCourseCompletionStatusQuery/error]`);
    throw error;
  }
};

export const userCurrentRoadmapCourseStatusQuery = async ({
  userId,
  roadmapId,
  roadmapCourseId = null,
  courseId = null,
}) => {
  logger.debug(
    userId,
    roadmapId,
    roadmapCourseId,
    courseId,
    `data being received: [userCurrentRoadmapCourseStatusQuery]`
  );
  let queryString = `
    SELECT ucp.id AS userCourseProgressId, ucp.total_modules AS totalModules,
           ucp.completed_modules AS completedModules, ucp.progress_percent AS progressPercent,
          ucp.created_at AS enrolledAt,
           ucp.is_completed AS isCompleted, ucp.completed_at AS completedAt,
           rcm.prerequisite_course_id AS prerequisiteCourseId, rcm.weekly_unlock AS isWeeklyUnlock,
           rcm.order AS courseOrder, rcm.is_active AS isActive,
            ucc.id AS userCourseCertificateId, ucc.certificate_url AS certificateUrl,
           c.id AS courseId, c.title AS courseTitle, c.thumbnail_url AS courseThumbnailUrl,
           c.level AS courseLevel, c.description AS courseDescription, c.tutor_id AS tutorId
    FROM user_course_progress ucp
    INNER JOIN roadmap_courses_mapping rcm ON ucp.roadmap_course_id = rcm.id
    INNER JOIN courses c ON rcm.course_id = c.id
    LEFT JOIN user_course_certificates ucc ON ucp.is_completed = 1 AND ucp.user_course_certificate_id = ucc.id
    WHERE ucp.user_id = ? AND rcm.roadmap_id = ?`;

  if (roadmapCourseId) {
    queryString += ` AND rcm.id = ?;`;
  } else if (courseId) {
    queryString += ` AND c.id = ?;`;
  }
  try {
    const result = await query(queryString, [userId, roadmapId, roadmapCourseId || courseId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [userCurrentRoadmapCourseStatusQuery/error]`);
    throw error;
  }
};

export const getCurrentRoadmapStatusQuery = async (userId, roadmapId) => {
  logger.debug(userId, roadmapId, `data being received: [getCurrentRoadmapStatusQuery]`);

  const queryString = `
    SELECT uer.id AS userEnrolledRoadmapId, uer.roadmap_id AS roadmapId, uer.enrolled_at AS enrolledAt
    FROM user_enrolled_roadmaps uer
    WHERE uer.user_id = ? AND uer.roadmap_id = ?;`;

  try {
    const result = await query(queryString, [userId, roadmapId]);
    return result.length ? result : null;
  } catch (error) {
    logger.error(error, `error being received: [getCurrentRoadmapStatusQuery/error]`);
    throw error;
  }
};

export const getRoadmapCourseMappingDetailsUnderRoadmapQuery = async (
  roadmapCourseId,
  roadmapId
) => {
  logger.debug(
    roadmapCourseId,
    roadmapId,
    `data being received: [getRoadmapCourseMappingDetailsUnderRoadmapQuery]`
  );

  const queryString = `
    SELECT rcm.id AS roadmapCourseId, rcm.roadmap_id AS roadmapId, rcm.course_id AS courseId,
           rcm.is_mandatory_to_proceed AS isMandatory, rcm.weekly_unlock AS isWeeklyUnlock,
           rcm.order AS courseOrder, rcm.prerequisite_course_id AS preRequisiteCourseId
    FROM roadmap_courses_mapping rcm
    WHERE rcm.id = ? AND rcm.roadmap_id = ?;`;

  try {
    const result = await query(queryString, [roadmapCourseId, roadmapId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(
      error,
      `error being received: [getRoadmapCourseMappingDetailsUnderRoadmapQuery/error]`
    );
    throw error;
  }
};

export const getTotalSectionsUnderRoadmapCourseQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getTotalSectionsUnderRoadmapCourseQuery]`);

  const queryString = `
    SELECT COUNT(*) AS totalSections,
       COUNT(DISTINCT s.module_week) AS totalModules,
       c.title AS courseTitle,
       c.description AS courseDescription,
       c.thumbnail_url AS courseThumbnailUrl
    FROM sections s
    INNER JOIN courses c ON s.course_id = c.id
    WHERE s.course_id = ? AND s.is_active = 1;`;

  try {
    const result = await query(queryString, [courseId]);
    return result.length ? result[0] : 0;
  } catch (error) {
    logger.error(error, `error being received: [getTotalSectionsUnderRoadmapCourseQuery/error]`);
    throw error;
  }
};

export const getUserRoadmapCourseOverallSummaryQuery = async (userId, roadmapCourseId) => {
  logger.debug(
    userId,
    roadmapCourseId,
    `data being received: [getUserRoadmapCourseOverallSummaryQuery]`
  );

  const queryString = `
    SELECT usp.module_week                         AS moduleWeek,
       CAST(SUM(CASE WHEN ucp.content_type = 'video' THEN 1 ELSE 0 END) AS UNSIGNED)                             AS totalVideos,
       CAST(SUM(CASE
               WHEN ucp.content_type = 'video' AND ucp.is_completed = 1 AND ucp.total_duration = ucp.watched_duration
                   THEN 1
               ELSE 0 END) AS UNSIGNED)  AS completedVideos,
       CAST(SUM(CASE WHEN ucp.content_type = 'document' THEN 1 ELSE 0 END) AS UNSIGNED)                          AS totalReadings,
       CAST(SUM(CASE WHEN ucp.content_type = 'document' AND ucp.is_completed = 1 THEN 1 ELSE 0 END) AS UNSIGNED) AS completedReadings,
       CAST(SUM(CASE WHEN ucp.content_type = 'quiz' THEN 1 ELSE 0 END) AS UNSIGNED)                              AS totalQuizzes,
       CAST(SUM(CASE WHEN ucp.content_type = 'quiz' AND ucp.is_completed = 1 THEN 1 ELSE 0 END) AS UNSIGNED)     AS completedQuizzes,
       CAST(ROUND(
               100 * AVG(
                       CASE
                           WHEN ucp.content_type = 'video' THEN GREATEST(
                                   LEAST(ucp.watched_duration / NULLIF(ucp.total_duration, 0), 1),
                                   0
                                                                )
                           ELSE CASE WHEN ucp.is_completed = 1 THEN 1 ELSE 0 END
                           END
                     ),
               0
      ) AS UNSIGNED) AS moduleCompletionPercent,
       CASE
           WHEN SUM(CASE WHEN ucp.is_unlocked = 1 THEN 1 ELSE 0 END) = 0 THEN 'locked'
           ELSE CASE
                    WHEN SUM(CASE WHEN ucp.is_completed = 1 THEN 1 ELSE 0 END) = COUNT(DISTINCT ucp.id) THEN 'completed'
                    ELSE 'in-progress' END END AS status
    FROM user_chapter_progress ucp
            INNER JOIN user_section_progress usp ON ucp.user_enrolled_section_progress_id = usp.id
    WHERE ucp.user_id = ?
      AND ucp.roadmap_course_id = ?
    GROUP BY usp.module_week
    ORDER BY usp.module_week;`;

  try {
    const result = await query(queryString, [userId, roadmapCourseId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getUserRoadmapCourseOverallSummaryQuery/error]`);
    throw error;
  }
};

export const getModuleLevelCourseProgressQueryWithChapters = async (
  userId,
  roadmapCourseId,
  moduleWeek
) => {
  logger.debug(
    userId,
    roadmapCourseId,
    moduleWeek,
    `data being received: [getModuleLevelCourseProgressQueryWithChapters]`
  );

  const queryString = `
    SELECT usp.module_week      AS moduleWeek,
       usp.section_id       AS courseSectionId,
       s.title              AS sectionTitle,
       s.description        AS sectionDescription,
       usp.total_chapters   AS sectionTotalChapters,
       ucp.chapter_id       AS chapterId,
       ucp.content_type     AS contentType,
       c.title              AS chapterTitle,
       c.description        AS chapterDescription,
       ucp.watched_duration AS watchedDuration,
       ucp.total_duration   AS totalDuration,
       ucp.is_unlocked      AS isChapterUnlocked,
       ucp.unlocked_at      AS unlockedAt,
       ucp.is_completed     AS isCompleted,
       ucp.content_ref_id   AS contentRefId,
       ucp.current_quiz_attempt_id AS currentQuizAttemptId,
       ucp.latest_project_submission_id AS latestProjectSubmissionId,
       qm.xp_points         AS quizXpPoints,
       pm.xp_points         AS projectXpPoints,
       qm.id                AS quizMappingId,
       pm.id                AS projectMappingId,
       uqa.id               AS quizAttemptId,
       uqa.score            AS quizScore,
       uqa.total_points     AS quizTotalPoints,
       uqa.status           AS quizAttemptStatus,
       uqa.started_at       AS quizStartedAt,
       uqa.completed_at     AS quizCompletedAt,
       usp.module_week      AS moduleWeek,
       -- Project submission details
       ups.id               AS projectSubmissionId,
       ups.attempt_number   AS projectAttemptNumber,
       ups.github_url       AS projectGithubUrl,
       ups.doc_url          AS projectDocUrl,
       ups.deployed_url     AS projectDeployedUrl,
       ups.submission_comment AS projectSubmissionComment,
       ups.status           AS projectSubmissionStatus,
       ups.tutor_review_comment AS projectTutorComment,
       ups.reviewed_by      AS projectReviewedBy,
       ups.submitted_at     AS projectSubmittedAt,
       ups.reviewed_at      AS projectReviewedAt,
       CAST(ROUND(
               100 * GREATEST(
                       CASE
                           WHEN ucp.content_type = 'video' THEN GREATEST(
                                   LEAST(ucp.watched_duration / NULLIF(ucp.total_duration, 0), 1),
                                   0)
                           ELSE CASE WHEN ucp.is_completed = 1 THEN 1 ELSE 0 END
                           END, 0)) AS UNSIGNED)                    AS completionPercent
      FROM user_chapter_progress ucp
              INNER JOIN user_section_progress usp ON ucp.user_enrolled_section_progress_id = usp.id
              INNER JOIN chapters c ON ucp.chapter_id = c.id
              INNER JOIN sections s ON ucp.section_id = s.id
              LEFT JOIN quiz_mapping qm ON ucp.content_type = 'quiz' AND ucp.content_ref_id = qm.id
              LEFT JOIN projects_mapping pm ON ucp.content_type = 'project' AND ucp.content_ref_id = pm.id
              LEFT JOIN user_quiz_attempts uqa ON ucp.content_type = 'quiz' AND ucp.current_quiz_attempt_id = uqa.id
              LEFT JOIN user_project_submissions ups ON ucp.content_type = 'project' AND ucp.latest_project_submission_id = ups.id
      WHERE ucp.user_id = ?
        AND ucp.roadmap_course_id = ?
        ${moduleWeek ? "AND usp.module_week = ?" : ""}
      ORDER BY usp.module_week, ucp.chapter_id;`;

  try {
    const result = await query(queryString, [userId, roadmapCourseId, moduleWeek]);
    return result;
  } catch (error) {
    logger.error(
      error,
      `error being received: [getModuleLevelCourseProgressQueryWithChapters/error]`
    );
    throw error;
  }
};

export const getUserNotesQuery = async (
  userId,
  roadmapCourseId,
  moduleWeek,
  sectionId,
  chapterId
) => {
  let queryString = `SELECT id AS noteId, roadmap_course_id AS roadmapCourseId, module_week AS moduleWeek, section_id AS sectionId, chapter_id AS chapterId, note_content AS noteContent, created_at AS createdAt, updated_at AS updatedAt FROM user_course_notes WHERE user_id = ?`;
  const params = [userId];
  if (roadmapCourseId) {
    queryString += " AND roadmap_course_id = ?";
    params.push(roadmapCourseId);
  }
  if (moduleWeek) {
    queryString += " AND module_week = ?";
    params.push(moduleWeek);
  }
  if (sectionId) {
    queryString += " AND section_id = ?";
    params.push(sectionId);
  }
  if (chapterId) {
    queryString += " AND chapter_id = ?";
    params.push(chapterId);
  }
  queryString += " ORDER BY updated_at DESC";
  try {
    return await query(queryString, params);
  } catch (error) {
    logger.error(error, "[getUserNotesQuery]");
    throw error;
  }
};

export const addUserNoteQuery = async (
  userId,
  roadmapCourseId,
  moduleWeek,
  sectionId,
  chapterId,
  noteContent
) => {
  const queryString = `INSERT INTO user_course_notes (user_id, roadmap_course_id, module_week, section_id, chapter_id, note_content) VALUES (?, ?, ?, ?, ?, ?)`;
  try {
    const result = await query(queryString, [
      userId,
      roadmapCourseId,
      moduleWeek,
      sectionId,
      chapterId,
      noteContent,
    ]);
    return result.insertId;
  } catch (error) {
    logger.error(error, "[addUserNoteQuery]");
    throw error;
  }
};

export const editUserNoteQuery = async (userId, noteId, noteContent) => {
  const queryString = `UPDATE user_course_notes SET note_content = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`;
  try {
    await query(queryString, [noteContent, noteId, userId]);
    return true;
  } catch (error) {
    logger.error(error, "[editUserNoteQuery]");
    throw error;
  }
};

// Project submission queries
export const getLatestProjectSubmissionQuery = async (userId, contentRefId) => {
  const queryString = `SELECT id, status, attempt_number AS attemptNumber FROM user_project_submissions WHERE user_id = ? AND course_project_task_id = ? AND is_latest = 1 ORDER BY submitted_at DESC LIMIT 1`;
  try {
    const [result] = await query(queryString, [userId, contentRefId]);
    return result || null;
  } catch (error) {
    logger.error(error, "[getLatestProjectSubmissionQuery]");
    throw error;
  }
};

export const submitProjectQuery = {
  markPreviousNotLatest: async (submissionId) => {
    const queryString = `UPDATE user_project_submissions SET is_latest = 0 WHERE id = ?`;
    try {
      await query(queryString, [submissionId]);
    } catch (error) {
      logger.error(error, "[markPreviousNotLatest]");
      throw error;
    }
  },
  insert: async ({
    userId,
    contentRefId,
    attemptNumber,
    githubUrl,
    docUrl,
    deployedUrl,
    submissionComment,
  }) => {
    logger.debug(
      userId,
      contentRefId,
      attemptNumber,
      githubUrl,
      docUrl,
      deployedUrl,
      submissionComment,
      `data being received: [submitProjectQuery.insert]`
    );
    const queryString = `INSERT INTO user_project_submissions (user_id, course_project_task_id, attempt_number, github_url, doc_url, deployed_url, submission_comment, status, is_latest) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', 1);`;
    try {
      const result = await query(queryString, [
        userId,
        contentRefId,
        attemptNumber,
        githubUrl,
        docUrl,
        deployedUrl,
        submissionComment,
      ]);
      return result.insertId;
    } catch (error) {
      logger.error(error, "[submitProjectQuery.insert]");
      throw error;
    }
  },
};

export const getCurrentSectionWithModuleForUserOngoingCourseQuery = async (
  userId,
  roadmapCourseId
) => {
  logger.debug(
    userId,
    roadmapCourseId,
    `data being received: [getCurrentSectionWithModuleForUserOngoingCourseQuery]`
  );

  const queryString = `
    SELECT usp.section_id AS sectionId, usp.module_week AS moduleWeek, usp.is_unlocked AS isSectionUnlocked
    FROM user_section_progress usp
    INNER JOIN user_course_progress ucp ON usp.user_enrolled_course_progress_id = ucp.id
    WHERE ucp.user_id = ? AND ucp.roadmap_course_id = ? AND usp.is_completed = 0
    AND usp.is_unlocked = 1
    ORDER BY usp.unlocked_at;`;

  try {
    const result = await query(queryString, [userId, roadmapCourseId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(
      error,
      `error being received: [getCurrentSectionWithModuleForUserOngoingCourseQuery/error]`
    );
    throw error;
  }
};

export const getUserRoadmapOngoingCourseQuery = async (userEnrolledRoadmapId) => {
  logger.debug(userEnrolledRoadmapId, `data being received: [getUserRoadmapOngoingCourseQuery]`);

  const queryString = `
    SELECT
      ucp.roadmap_course_id AS roadmapCourseId,
      ucp.course_id AS courseId,
      ucp.completed_modules AS completedModules,
      ucp.total_modules AS totalModules,
      ucp.progress_percent AS progressPercent,
      c.title AS courseTitle,
      c.description AS courseDescription,
      c.thumbnail_url AS courseThumbnailUrl,
      r.roadmap_name AS roadmapName,
      usp.module_week AS currentModuleWeek,
      usp.section_id AS currentSectionId,
      ucp2.chapter_id AS currentChapterId,
      ch.title AS chapterTitle,
      ch.description AS chapterDescription,
      ch.content_type AS contentType,
      ch.content_ref_id AS contentRefId,
      ucp2.current_quiz_attempt_id AS currentQuizAttemptId,
      ucp2.latest_project_submission_id AS latestProjectSubmissionId,
      ucp2.watched_duration AS userWatchDuration,
      ucp2.total_duration AS chapterTotalDuration,
      ucp2.is_completed AS isChapterCompleted,
      -- Quiz attempt details
      uqa.id AS quizAttemptId,
      uqa.score AS quizScore,
      uqa.total_points AS quizTotalPoints,
      uqa.status AS quizAttemptStatus,
      uqa.started_at AS quizStartedAt,
      uqa.completed_at AS quizCompletedAt,
      -- Project submission details
      ups.id AS projectSubmissionId,
      ups.attempt_number AS projectAttemptNumber,
      ups.github_url AS projectGithubUrl,
      ups.doc_url AS projectDocUrl,
      ups.deployed_url AS projectDeployedUrl,
      ups.submission_comment AS projectSubmissionComment,
      ups.status AS projectSubmissionStatus,
      ups.tutor_review_comment AS projectTutorComment,
      ups.reviewed_by AS projectReviewedBy,
      ups.submitted_at AS projectSubmittedAt,
      ups.reviewed_at AS projectReviewedAt
    FROM user_course_progress ucp
    INNER JOIN user_section_progress usp ON ucp.id = usp.user_enrolled_course_progress_id
    INNER JOIN user_chapter_progress ucp2 ON usp.id = ucp2.user_enrolled_section_progress_id
    INNER JOIN courses c ON ucp.course_id = c.id
    INNER JOIN user_enrolled_roadmaps uer ON ucp.user_enrolled_roadmap_id = uer.id
    INNER JOIN roadmaps r ON uer.roadmap_id = r.id
    INNER JOIN chapters ch ON ucp2.chapter_id = ch.id
    LEFT JOIN user_quiz_attempts uqa ON ch.content_type = 'quiz' AND ucp2.current_quiz_attempt_id = uqa.id
    LEFT JOIN user_project_submissions ups ON ch.content_type = 'project' AND ucp2.latest_project_submission_id = ups.id
    INNER JOIN (
      SELECT 
        ucp_inner.roadmap_course_id,
        MAX(ucp2_inner.unlocked_at) AS max_unlocked_at
      FROM user_course_progress ucp_inner
      INNER JOIN user_section_progress usp_inner ON ucp_inner.id = usp_inner.user_enrolled_course_progress_id
      INNER JOIN user_chapter_progress ucp2_inner ON usp_inner.id = ucp2_inner.user_enrolled_section_progress_id
      WHERE ucp_inner.user_enrolled_roadmap_id = ?
        AND ucp_inner.is_completed = 0
        AND ucp2_inner.is_unlocked = 1
        AND ucp2_inner.is_completed = 0
      GROUP BY ucp_inner.roadmap_course_id
    ) latest_chapters ON ucp.roadmap_course_id = latest_chapters.roadmap_course_id 
                      AND ucp2.unlocked_at = latest_chapters.max_unlocked_at
    WHERE ucp.user_enrolled_roadmap_id = ?
      AND ucp.is_completed = 0
      AND ucp2.is_unlocked = 1
      AND ucp2.is_completed = 0
    ORDER BY ucp2.unlocked_at DESC;
  `;

  try {
    const result = await query(queryString, [userEnrolledRoadmapId, userEnrolledRoadmapId]);
    return result.length ? result : null;
  } catch (error) {
    logger.error(error, `error being received: [getUserRoadmapOngoingCourseQuery/error]`);
    throw error;
  }
};

export const getUserRoadmapUpcomingCoursesQuery = async (userId, roadmapId) => {
  logger.debug(userId, roadmapId, `data being received: [getUserRoadmapUpcomingCoursesQuery]`);

  const queryString = `
    SELECT
    rcm.id AS roadmapCourseId,
    rcm.course_id AS courseId,
    c.title AS courseTitle,
    c.description AS courseDescription,
    c.thumbnail_url AS courseThumbnailUrl,
    rcm.order AS orderSequence,
    t.name AS authorName,
    GROUP_CONCAT(DISTINCT tg.title) AS tags,
    ROUND(AVG(cr.rating), 2) AS averageRating,
    COUNT(DISTINCT ucp_all.user_id) AS enrolledCount,
        CASE
            WHEN rcm.prerequisite_course_id IS NULL THEN 'ready-to-enroll'
            WHEN prereq_ucp.is_completed = 1 THEN 'ready-to-enroll'
            ELSE 'locked'
        END AS courseStatus
    FROM
        roadmap_courses_mapping rcm
        INNER JOIN courses c ON rcm.course_id = c.id
        LEFT JOIN tutors t ON c.tutor_id = t.id
        LEFT JOIN course_tags ct ON c.id = ct.course_id
        LEFT JOIN tags tg ON ct.tag_id = tg.id
        LEFT JOIN course_reviews cr ON c.id = cr.course_id
        AND cr.is_active = 1
        LEFT JOIN user_course_progress ucp_all ON rcm.id = ucp_all.roadmap_course_id
        LEFT JOIN user_course_progress prereq_ucp ON rcm.prerequisite_course_id = prereq_ucp.roadmap_course_id
        AND prereq_ucp.user_id = ?
    WHERE
        rcm.roadmap_id = ?
    GROUP BY
        rcm.id
    ORDER BY rcm.order;
  `;

  try {
    const result = await query(queryString, [userId, roadmapId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getUserRoadmapUpcomingCoursesQuery/error]`);
    throw error;
  }
};

export const getUserEnrolledRoadmapsQuery = async (userId) => {
  logger.debug(userId, `data being received: [getUserEnrolledRoadmapsQuery]`);

  const queryString = `
    SELECT uer.id AS userEnrolledRoadmapId, r.id AS roadmapId, r.roadmap_name AS roadmapName, uer.enrolled_at AS enrolledAt
    FROM user_enrolled_roadmaps uer
    INNER JOIN roadmaps r ON uer.roadmap_id = r.id
    WHERE uer.user_id = ?;`;

  try {
    const result = await query(queryString, [userId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getUserEnrolledRoadmapsQuery/error]`);
    throw error;
  }
};

export const getUserEnrolledRoadmapsWithCurrentCourseQuery = async (userId) => {
  logger.debug(userId, `data being received: [getUserEnrolledRoadmapsWithCurrentCourseQuery]`);

  const queryString = `
    SELECT 
      uer.id AS userEnrolledRoadmapId,
      r.id AS roadmapId,
      r.roadmap_name AS roadmapName,
      r.roadmap_description AS roadmapDescription,
      uer.enrolled_at AS enrolledAt,
      -- Current ongoing course details
      ucp.roadmap_course_id AS currentRoadmapCourseId,
      ucp.course_id AS currentCourseId,
      c.title AS currentCourseTitle,
      c.description AS currentCourseDescription,
      c.thumbnail_url AS currentCourseThumbnailUrl,
      ucp.completed_modules AS currentCourseCompletedModules,
      ucp.total_modules AS currentCourseTotalModules,
      ucp.progress_percent AS currentCourseProgressPercent,
      ucp.created_at AS currentCourseEnrolledAt,
      -- Current chapter details
      usp.module_week AS currentModuleWeek,
      usp.section_id AS currentSectionId,
      ucp2.chapter_id AS currentChapterId,
      ch.title AS currentChapterTitle,
      ch.content_type AS currentChapterContentType,
      ucp2.is_completed AS isCurrentChapterCompleted
    FROM user_enrolled_roadmaps uer
    INNER JOIN roadmaps r ON uer.roadmap_id = r.id AND r.is_active = 1
    LEFT JOIN (
      -- Get the most recently enrolled ongoing course per roadmap
      SELECT 
        ucp_inner.*,
        ROW_NUMBER() OVER (PARTITION BY ucp_inner.user_enrolled_roadmap_id ORDER BY ucp_inner.created_at DESC) as rn
      FROM user_course_progress ucp_inner
      WHERE ucp_inner.user_id = ? AND ucp_inner.is_completed = 0
    ) ucp ON uer.id = ucp.user_enrolled_roadmap_id AND ucp.rn = 1
    LEFT JOIN courses c ON ucp.course_id = c.id
    LEFT JOIN user_section_progress usp ON ucp.id = usp.user_enrolled_course_progress_id 
      AND usp.is_completed = 0 AND usp.is_unlocked = 1
    LEFT JOIN user_chapter_progress ucp2 ON usp.id = ucp2.user_enrolled_section_progress_id 
      AND ucp2.is_completed = 0 AND ucp2.is_unlocked = 1
    LEFT JOIN chapters ch ON ucp2.chapter_id = ch.id
    WHERE uer.user_id = ?
    ORDER BY uer.enrolled_at DESC, ucp2.unlocked_at DESC;
  `;

  try {
    const result = await query(queryString, [userId, userId]);
    return result;
  } catch (error) {
    logger.error(
      error,
      `error being received: [getUserEnrolledRoadmapsWithCurrentCourseQuery/error]`
    );
    throw error;
  }
};

export const getRoadmapCoursesWithStatusQuery = async (userId, roadmapId) => {
  logger.debug(userId, roadmapId, `data being received: [getRoadmapCoursesWithStatusQuery]`);

  const queryString = `
    SELECT 
      rcm.id AS roadmapCourseId,
      rcm.course_id AS courseId,
      rcm.order AS courseOrder,
      rcm.prerequisite_course_id AS prerequisiteCourseId,
      rcm.is_mandatory_to_proceed AS isMandatory,
      rcm.weekly_unlock AS weeklyUnlock,
      c.title AS courseTitle,
      c.description AS courseDescription,
      c.thumbnail_url AS courseThumbnailUrl,
      c.level AS courseLevel,
      COUNT(DISTINCT s.module_week) AS totalModules,
      COUNT(DISTINCT s.id) AS totalSections,
      COUNT(DISTINCT ch.id) AS totalChapters,
      COALESCE(ucp.completed_modules, 0) AS completedModules,
      COALESCE(ucp.progress_percent, 0) AS progressPercent,
      ucp.created_at AS enrolledAt,
      ucp.completed_at AS completedAt,
      ucp.is_completed AS isCompleted,
      CASE 
        WHEN ucp.id IS NULL THEN 
          CASE 
            WHEN rcm.prerequisite_course_id IS NULL THEN 'ready-to-enroll'
            WHEN prereq_ucp.is_completed = 1 THEN 'ready-to-enroll'
            ELSE 'locked'
          END
        WHEN ucp.is_completed = 1 THEN 'completed'
        ELSE 'in-progress'
      END AS courseStatus
    FROM roadmap_courses_mapping rcm
    INNER JOIN courses c ON rcm.course_id = c.id AND c.is_active = 1
    INNER JOIN sections s ON c.id = s.course_id AND s.is_active = 1
    LEFT JOIN chapters ch ON s.id = ch.section_id AND ch.is_active = 1
    LEFT JOIN user_course_progress ucp ON rcm.id = ucp.roadmap_course_id AND ucp.user_id = ?
    LEFT JOIN user_course_progress prereq_ucp ON rcm.prerequisite_course_id = prereq_ucp.roadmap_course_id AND prereq_ucp.user_id = ?
    WHERE rcm.roadmap_id = ? 
      AND rcm.is_active = 1
    GROUP BY 
      rcm.id, rcm.course_id, rcm.order, rcm.prerequisite_course_id, 
      rcm.is_mandatory_to_proceed, rcm.weekly_unlock,
      c.title, c.description, c.thumbnail_url, c.level,
      ucp.id, ucp.completed_modules, ucp.progress_percent, ucp.created_at, 
      ucp.completed_at, ucp.is_completed, prereq_ucp.is_completed
    ORDER BY rcm.order;
  `;

  try {
    const result = await query(queryString, [userId, userId, roadmapId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getRoadmapCoursesWithStatusQuery/error]`);
    throw error;
  }
};

export const getAbstractUserEnrolledRoadmapAndCurrentCourseQuery = async (userId) => {
  logger.debug(
    userId,
    `data being received: [getAbstractUserEnrolledRoadmapAndCurrentCourseQuery]`
  );

  const queryString = `
    SELECT r.roadmap_name                  AS roadmapName,
       r.id                            AS roadmapId,
       ucp.roadmap_course_id           as roadmapCourseId,
       c.id                            as courseId,
       c.title                         AS currentCourseTitle,
       COUNT(DISTINCT usp.module_week) AS totalModules,
       CASE
           WHEN ucp.is_completed = 0 THEN 'in-progress'
           ELSE 'completed'
           END                         AS courseStatus
    FROM user_enrolled_roadmaps uer
            INNER JOIN roadmaps r ON uer.roadmap_id = r.id
            INNER JOIN user_course_progress ucp ON uer.id = ucp.user_enrolled_roadmap_id
            INNER JOIN courses c ON ucp.course_id = c.id
            INNER JOIN user_section_progress usp ON ucp.id = usp.user_enrolled_course_progress_id
    WHERE uer.user_id = 29
      AND r.is_active = 1
      AND (
        ucp.is_completed = 0
            OR (
            ucp.is_completed = 1
                AND NOT EXISTS (SELECT 1
                                FROM user_course_progress ucp2
                                WHERE ucp2.user_enrolled_roadmap_id = uer.id
                                  AND ucp2.is_completed = 0)
            )
        )
    GROUP BY uer.id, r.roadmap_name, c.title, ucp.course_id, ucp.is_completed
    ORDER BY CASE WHEN ucp.is_completed = 0 THEN 0 ELSE 1 END,
            CASE WHEN ucp.is_completed = 0 THEN ucp.created_at ELSE ucp.completed_at END DESC;
  `;

  try {
    const result = await query(queryString, [userId]);
    return result.length ? result : null;
  } catch (error) {
    logger.error(
      error,
      `error being received: [getAbstractUserEnrolledRoadmapAndCurrentCourseQuery/error]`
    );
    throw error;
  }
};

export const getUserCompletedCertificatesQuery = async (userId) => {
  logger.debug(userId, `data being received: [getUserCompletedCertificatesQuery]`);

  const queryString = `
    SELECT ucc.id              AS userCourseCertificateId,
       ucc.certificate_url AS certificateUrl,
       rcm.roadmap_id      AS roadmapId,
       rcm.course_id       AS courseId,
       ucp.created_at      AS enrolledAt,
       ucp.completed_at    AS completedAt
    FROM user_course_certificates ucc
            INNER JOIN user_course_progress ucp ON ucc.roadmap_course_id = ucp.roadmap_course_id
            INNER JOIN roadmap_courses_mapping rcm ON ucp.roadmap_course_id = rcm.id
    WHERE ucc.user_id = ?
      AND ucp.is_completed = 1;`;

  try {
    const result = await query(queryString, [userId]);
    logger.debug(result, `result being received: [getUserCompletedCertificatesQuery]`);
    if (!result.length) {
      return [];
    }
    const finalResult = await Promise.map(result, async (certificate) => {
      const courseDetails = await getCourseBasicDetailsQuery(certificate.courseId);
      return {
        ...certificate,
        courseStatus: "completed",
        courseTitle: courseDetails ? courseDetails.courseTitle : null,
        courseThumbnailUrl: courseDetails ? courseDetails.courseThumbnailUrl : null,
        courseLevel: courseDetails ? courseDetails.courseLevel : null,
        courseDescription: courseDetails ? courseDetails.courseDescription : null,
        tutorId: courseDetails ? courseDetails.tutorId : null,
        authorName: courseDetails ? courseDetails.tutorName : null,
        courseTags: courseDetails ? String(courseDetails.tagNames).split(",") : null,
      };
    });
    return finalResult;
  } catch (error) {
    logger.error(error, `error being received: [getUserCompletedCertificatesQuery/error]`);
    throw error;
  }
};

export const getCourseBasicDetailsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseBasicDetailsQuery]`);

  const queryString = `
    SELECT c.id AS courseId, c.title AS courseTitle, c.description AS courseDescription,
           c.thumbnail_url AS courseThumbnailUrl, c.level AS courseLevel,
           c.tutor_id AS tutorId, t.name as tutorName, GROUP_CONCAT(tags.title) as tagNames
    FROM courses c
    INNER JOIN tutors t ON c.tutor_id = t.id
    INNER JOIN course_tags ct ON c.id = ct.course_id
    INNER JOIN tags ON ct.tag_id = tags.id
    WHERE c.id = ? AND c.is_active = 1;`;

  try {
    const result = await query(queryString, [courseId]);
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(error, `error being received: [getCourseBasicDetailsQuery/error]`);
    throw error;
  }
};

export const getModuleDetailsBasedOnRoadmapCourseIdQuery = async (roadmapCourseId) => {
  logger.debug(
    roadmapCourseId,
    `data being received: [getModuleDetailsBasedOnRoadmapCourseIdQuery]`
  );

  const queryString = `
    SELECT
      s.module_week AS moduleWeek,
      s.id AS sectionId,
      s.title AS sectionTitle,
      s.description AS sectionDescription,
      s.display_order AS sectionOrder,
      ch.content_duration AS sectionDuration,
      ch.id AS chapterId,
      ch.title AS chapterTitle,
      ch.description AS chapterDescription,
      0 AS watchedDuration,
      0 AS isChapterUnlocked,
      null As unlockedAt,
      0 AS isCompleted,
      0 AS completionPercent,
      ch.content_ref_id AS contentRefId,
      null AS currentQuizAttemptId,
      qm.xp_points AS quizXpPoints,
      null AS latestProjectSubmissionId,
      null AS quizAttemptId,
      null AS quizScore,
      null AS quizTotalPoints,
      null AS quizAttemptStatus,
      null AS quizStartedAt,
      null AS quizCompletedAt,
      null AS projectSubmissionId,
      null AS projectAttemptNumber,
      null AS projectGithubUrl,
      null AS projectDocUrl,
      null AS projectDeployedUrl,
      null AS projectSubmissionComment,
      null AS projectSubmissionStatus,
      null AS projectTutorComment,
      null AS projectReviewedBy,
      null AS projectSubmittedAt,
      null AS projectReviewedAt,
      ch.content_type as contentType,
      ch.content_duration AS totalDuration,
      qm.id as quizMappingId,
      q.title as quizTitle,
      q.description as quizDescription,
      pm.id as projectMappingId,
      p.title as projectTitle,
      p.description as projectDescription
    FROM sections s
    JOIN chapters ch ON ch.section_id = s.id
    JOIN roadmap_courses_mapping rcm ON s.course_id = rcm.course_id
    LEFT JOIN quiz_mapping qm ON ch.content_type = 'quiz' AND ch.content_ref_id = qm.id
    LEFT JOIN quizzes q ON ch.content_type = 'quiz' AND qm.quiz_id = q.id
    LEFT JOIN projects_mapping pm ON ch.content_type = 'project' AND ch.content_ref_id = pm.id
    LEFT JOIN projects p ON ch.content_type = 'project' AND pm.project_id = p.id
    WHERE rcm.id = ? AND s.is_active = 1 AND ch.is_active = 1
    GROUP BY s.module_week, s.id, ch.id
    ORDER BY s.module_week, s.display_order, ch.display_order;`;

  try {
    const result = await query(queryString, [roadmapCourseId]);
    return result;
  } catch (error) {
    logger.error(
      error,
      `error being received: [getModuleDetailsBasedOnRoadmapCourseIdQuery/error]`
    );
    throw error;
  }
};

export const getCourseFaqsQuery = async (courseId) => {
  logger.debug(courseId, `data being received: [getCourseFaqsQuery]`);

  const queryString = `
    SELECT question, answer, id as faqId
    FROM course_faqs
    WHERE course_id = ? AND is_active = 1
    ORDER BY display_order ASC;
  `;

  try {
    const result = await query(queryString, [courseId]);
    return result;
  } catch (error) {
    logger.error(error, `error being received: [getCourseFaqsQuery/error]`);
    throw error;
  }
};

export const getUserOrgId = async (userId) => {
  try {
    const orgQuery = `SELECT org_id AS orgId FROM users WHERE id = ? LIMIT 1`;
    return await query(orgQuery, [userId]);
  } catch (error) {
    logger.error(error, "[getUserOrgId/error]");
    throw error;
  }
};
