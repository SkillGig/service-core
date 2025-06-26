import Bluebird from "bluebird";
import logger from "../../../config/logger.js";
import { query } from "../../../config/db.js";
import {
  checkIfCourseIsAlreadyEnrolledToCourseQuery,
  enrollUserToCourseUsingRoadmapCourseIdQuery,
  getAllSectionsUnderCourseQuery,
  getAllChaptersUnderSectionQuery,
  insertIntoUserChapterProgressQuery,
  insertIntoUserSectionProgressQuery,
  insertUserCourseProgressQuery,
} from "../services/user-common.query.js";

const Promise = Bluebird;

/**
 * Enrolls a user to the first course in a roadmap
 * Creates course progress tracking and unlocks appropriate modules based on course settings
 *
 * @param {Array} allCoursesUnderRoadmap - Array of courses in the roadmap
 * @param {number} userId - The ID of the user to enroll
 * @returns {Object} Result object with success status and message
 * @throws {Error} If enrollment fails at any step
 */
export const enrollUserToTheFirstCourseInRoadmap = async (
  allCoursesUnderRoadmap,
  userId
) => {
  try {
    // Validate input parameters
    if (
      !Array.isArray(allCoursesUnderRoadmap) ||
      allCoursesUnderRoadmap.length === 0
    ) {
      throw new Error("No courses available in the roadmap to enroll.");
    }

    if (!userId || typeof userId !== "number") {
      throw new Error("Valid user ID is required for enrollment.");
    }

    const firstCourse = allCoursesUnderRoadmap[0];
    logger.debug(
      {
        userId,
        courseId: firstCourse.courseId,
        roadmapCourseId: firstCourse.roadmapCourseId,
      },
      "Starting enrollment process for first course in roadmap"
    );

    // Check if the user is already enrolled in the first course
    const isUserAlreadyEnrolled =
      await checkIfCourseIsAlreadyEnrolledToCourseQuery(
        userId,
        firstCourse.roadmapCourseId
      );

    if (isUserAlreadyEnrolled) {
      logger.info(
        { userId, roadmapCourseId: firstCourse.roadmapCourseId },
        "User is already enrolled in the first course"
      );
      return {
        success: true,
        message: "User is already enrolled in the first course of the roadmap.",
      };
    }

    // Start database transaction for atomic enrollment
    await query("START TRANSACTION");

    try {
      // Step 1: Enroll user to the course
      const enrollResult = await enrollUserToCourseUsingRoadmapCourseIdQuery(
        userId,
        firstCourse.roadmapCourseId
      );

      if (enrollResult.affectedRows === 0) {
        throw new Error(
          "Failed to enroll user in the first course of the roadmap."
        );
      }

      // Step 2: Get all sections under the course
      const totalSectionsUnderCourse = await getAllSectionsUnderCourseQuery(
        firstCourse.courseId
      );

      if (totalSectionsUnderCourse.length === 0) {
        throw new Error(
          "No sections found under the first course of the roadmap."
        );
      }

      // Step 3: Create course progress record
      await insertUserCourseProgressQuery(
        userId,
        firstCourse.courseId,
        firstCourse.roadmapCourseId,
        totalSectionsUnderCourse.length
      );

      // Step 4: Unlock appropriate modules based on course settings
      await unlockAllModulesOfCourseToUser(
        firstCourse.courseId,
        firstCourse.roadmapCourseId,
        userId,
        firstCourse.isWeeklyUnlock,
        totalSectionsUnderCourse
      );

      // Commit transaction if all steps succeed
      await query("COMMIT");

      logger.info(
        { userId, courseId: firstCourse.courseId },
        "Successfully enrolled user to first course in roadmap"
      );

      return {
        success: true,
        message:
          "User successfully enrolled in the first course of the roadmap.",
      };
    } catch (transactionError) {
      // Rollback transaction on any error
      await query("ROLLBACK");
      throw transactionError;
    }
  } catch (error) {
    logger.error(
      {
        error: error.message,
        userId,
        courseId: allCoursesUnderRoadmap?.[0]?.courseId,
      },
      "[enrollUserToTheFirstCourseInRoadmap] Enrollment failed"
    );
    throw error;
  }
};

/**
 * Unlocks modules and sections for a user based on course unlock settings
 * Handles both weekly unlock and immediate unlock scenarios
 *
 * @param {number} courseId - The ID of the course
 * @param {number} roadmapCourseId - The roadmap course relationship ID
 * @param {number} userId - The ID of the user
 * @param {boolean} isWeeklyUnlock - Whether the course has weekly unlock mechanism
 * @param {Array} allSectionsUnderCourse - Array of sections in the course
 * @returns {Object} Result object with success status and message
 */
export const unlockAllModulesOfCourseToUser = async (
  courseId,
  roadmapCourseId,
  userId,
  isWeeklyUnlock,
  allSectionsUnderCourse
) => {
  try {
    // Validate input parameters
    if (!courseId || !roadmapCourseId || !userId) {
      throw new Error(
        "Course ID, roadmap course ID, and user ID are required."
      );
    }

    if (
      !Array.isArray(allSectionsUnderCourse) ||
      allSectionsUnderCourse.length === 0
    ) {
      throw new Error("No sections provided for module unlocking.");
    }

    logger.debug(
      {
        courseId,
        roadmapCourseId,
        userId,
        isWeeklyUnlock,
        sectionsCount: allSectionsUnderCourse.length,
      },
      "Starting module unlock process"
    );

    // Start transaction for atomic section and chapter unlocking
    await query("START TRANSACTION");

    try {
      // Process each section with controlled concurrency
      await Promise.map(
        allSectionsUnderCourse,
        async (section, sectionIndex) => {
          await processSectionUnlock(
            section,
            sectionIndex,
            courseId,
            roadmapCourseId,
            userId,
            isWeeklyUnlock
          );
        },
        { concurrency: 5 } // Limit concurrent operations to prevent database overload
      );

      // Commit transaction if all sections processed successfully
      await query("COMMIT");

      logger.info(
        { courseId, userId, sectionsProcessed: allSectionsUnderCourse.length },
        "Successfully unlocked all modules for user"
      );

      return {
        success: true,
        message: "All modules of the course have been unlocked for the user.",
      };
    } catch (transactionError) {
      // Rollback transaction on any error
      await query("ROLLBACK");
      throw transactionError;
    }
  } catch (error) {
    logger.error(
      {
        error: error.message,
        courseId,
        roadmapCourseId,
        userId,
      },
      "[unlockAllModulesOfCourseToUser] Module unlock failed"
    );

    return {
      success: false,
      message: `Failed to unlock all modules of the course for the user: ${error.message}`,
    };
  }
};

/**
 * Processes the unlocking of a single section and its chapters
 * Handles chapter progress creation and section unlock logic
 *
 * @param {Object} section - The section object to process
 * @param {number} sectionIndex - The index of the section in the course
 * @param {number} courseId - The ID of the course
 * @param {number} roadmapCourseId - The roadmap course relationship ID
 * @param {number} userId - The ID of the user
 * @param {boolean} isWeeklyUnlock - Whether the course has weekly unlock mechanism
 * @throws {Error} If section processing fails
 */
const processSectionUnlock = async (
  section,
  sectionIndex,
  courseId,
  roadmapCourseId,
  userId,
  isWeeklyUnlock
) => {
  try {
    logger.debug(
      { sectionId: section.sectionId, sectionIndex, courseId },
      "Processing section unlock"
    );

    // Get all chapters under the current section
    const allChaptersUnderSection = await getAllChaptersUnderSectionQuery(
      section.sectionId
    );

    if (allChaptersUnderSection.length === 0) {
      throw new Error(
        `No chapters found under section ${section.sectionId} of course ${courseId}`
      );
    }

    // Process each chapter in the section
    await Promise.map(
      allChaptersUnderSection,
      async (chapter, chapterIndex) => {
        await processChapterProgress(
          chapter,
          chapterIndex,
          sectionIndex,
          userId,
          roadmapCourseId,
          courseId,
          section.sectionId
        );
      },
      { concurrency: 5 }
    );

    // Determine if section should be unlocked
    const shouldUnlockSection = determineSectionUnlockStatus(
      sectionIndex,
      isWeeklyUnlock
    );

    // Create section progress record
    const unlockResult = await insertIntoUserSectionProgressQuery(
      userId,
      roadmapCourseId,
      courseId,
      section.sectionId,
      shouldUnlockSection,
      allChaptersUnderSection.length,
      0 // Initial completed chapters count
    );

    if (unlockResult.affectedRows === 0) {
      throw new Error(
        `Failed to unlock section ${section.sectionId} for user ${userId}`
      );
    }

    logger.debug(
      { sectionId: section.sectionId, unlocked: shouldUnlockSection },
      "Section processed successfully"
    );
  } catch (error) {
    logger.error(
      {
        error: error.message,
        sectionId: section.sectionId,
        sectionIndex,
        courseId,
      },
      "[processSectionUnlock] Section processing failed"
    );
    throw error;
  }
};

/**
 * Processes the progress tracking for a single chapter
 * Creates chapter progress record with appropriate unlock status
 *
 * @param {Object} chapter - The chapter object to process
 * @param {number} chapterIndex - The index of the chapter in the section
 * @param {number} sectionIndex - The index of the section in the course
 * @param {number} userId - The ID of the user
 * @param {number} roadmapCourseId - The roadmap course relationship ID
 * @param {number} courseId - The ID of the course
 * @param {number} sectionId - The ID of the section
 * @throws {Error} If chapter processing fails
 */
const processChapterProgress = async (
  chapter,
  chapterIndex,
  sectionIndex,
  userId,
  roadmapCourseId,
  courseId,
  sectionId
) => {
  try {
    // First chapter of first section should be unlocked by default
    const shouldUnlockChapter =
      sectionIndex === 0 && chapterIndex === 0 ? 1 : 0;

    const insertChapterProgressResult =
      await insertIntoUserChapterProgressQuery(
        userId,
        roadmapCourseId,
        courseId,
        sectionId,
        chapter.chapterId,
        shouldUnlockChapter,
        chapter.chapterDuration
      );

    if (insertChapterProgressResult.affectedRows === 0) {
      throw new Error(
        `Failed to insert chapter progress for chapter ${chapter.chapterId} in section ${sectionId} of course ${courseId}`
      );
    }

    logger.debug(
      {
        chapterId: chapter.chapterId,
        unlocked: shouldUnlockChapter,
        duration: chapter.chapterDuration,
      },
      "Chapter progress created successfully"
    );
  } catch (error) {
    logger.error(
      {
        error: error.message,
        chapterId: chapter.chapterId,
        sectionId,
        courseId,
      },
      "[processChapterProgress] Chapter processing failed"
    );
    throw error;
  }
};

/**
 * Determines whether a section should be unlocked based on course settings
 *
 * @param {number} sectionIndex - The index of the section (0-based)
 * @param {boolean} isWeeklyUnlock - Whether the course has weekly unlock mechanism
 * @returns {number} 1 if section should be unlocked, 0 otherwise
 */
const determineSectionUnlockStatus = (sectionIndex, isWeeklyUnlock) => {
  if (!isWeeklyUnlock) {
    // If not weekly unlock, unlock all sections immediately
    return 1;
  } else {
    // If weekly unlock, only unlock the first section initially
    return sectionIndex === 0 ? 1 : 0;
  }
};

