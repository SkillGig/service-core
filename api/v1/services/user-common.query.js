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
       oec.branding_message AS brandingMessage
    FROM users u
            INNER JOIN organizations o ON u.org_id = o.id
            INNER JOIN org_extra_configs oec ON o.id = oec.org_id
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
  totalSections,
  userRoadmapId,
  conn
) => {
  const queryString = `INSERT INTO user_course_progress (user_id, roadmap_course_id, course_id, user_enrolled_roadmap_id, total_sections, completed_sections, progress_percent)
    VALUES (?, ?, ?, ?, ?, 0, 0)
    ON DUPLICATE KEY UPDATE total_sections = ?, updated_at = NOW();`;
  try {
    if (conn) {
      return await queryWithConn(conn, queryString, [
        userId,
        roadmapCourseId,
        courseId,
        userRoadmapId,
        totalSections,
        totalSections,
      ]);
    }
    return await query(queryString, [
      userId,
      roadmapCourseId,
      courseId,
      userRoadmapId,
      totalSections,
      totalSections,
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
    SELECT pm.id as projectMappingId, p.id AS projectId, p.title AS projectTitle, p.description AS projectDescription, p.is_active AS isActive
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
    SELECT ucp.total_sections AS totalSections,
           ucp.completed_sections AS completedSections, ucp.progress_percent AS progressPercent, ucp.is_completed AS isCompleted
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
    SELECT ucp.id AS userCourseProgressId, ucp.total_sections AS totalSections,
           ucp.completed_sections AS completedSections, ucp.progress_percent AS progressPercent,
          ucp.created_at AS enrolledAt,
           ucp.is_completed AS isCompleted, ucp.completed_at AS completedAt,
           rcm.prerequisite_course_id AS prerequisiteCourseId, rcm.weekly_unlock AS isWeeklyUnlock,
           rcm.order AS courseOrder, rcm.is_active AS isActive,
           c.id AS courseId, c.title AS courseTitle, c.thumbnail_url AS courseThumbnailUrl,
           c.level AS courseLevel, c.description AS courseDescription, c.tutor_id AS tutorId
    FROM user_course_progress ucp
    INNER JOIN roadmap_courses_mapping rcm ON ucp.roadmap_course_id = rcm.id
    INNER JOIN courses c ON rcm.course_id = c.id
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
    return result.length ? result[0] : null;
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
    SELECT COUNT(*) AS totalSections, c.title AS courseTitle, c.description AS courseDescription, c.thumbnail_url AS courseThumbnailUrl
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
