import Bluebird from "bluebird";
import logger from "../../../config/logger.js";
import {
  checkIfCourseIsAlreadyEnrolledToCourseQuery,
  getAllSectionsUnderCourseQuery,
  getAllChaptersUnderSectionQuery,
  insertIntoUserChapterProgressQuery,
  insertIntoUserSectionProgressQuery,
  insertUserCourseProgressQuery,
  getQuizDetailsQuery,
  getProjectDetailsQuery,
} from "../services/user-common.query.js";

const Promise = Bluebird;

export const enrollUserToTheFirstCourseInRoadmap = async (
  allCoursesUnderRoadmap,
  userId,
  userRoadmapId,
  conn
) => {
  try {
    // Validate input parameters
    if (
      !Array.isArray(allCoursesUnderRoadmap) ||
      allCoursesUnderRoadmap.length === 0 ||
      !userRoadmapId
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
    const isUserAlreadyEnrolled = await checkIfCourseIsAlreadyEnrolledToCourseQuery(
      userId,
      firstCourse.roadmapCourseId,
      conn
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

    // Step 1: Get all sections under the course
    const totalSectionsUnderCourse = await getAllSectionsUnderCourseQuery(
      firstCourse.courseId,
      conn
    );

    if (totalSectionsUnderCourse.length === 0) {
      throw new Error("No sections found under the first course of the roadmap.");
    }

    // Step 2: Create course progress record
    const courseResult = await insertUserCourseProgressQuery(
      userId,
      firstCourse.roadmapCourseId,
      firstCourse.courseId,
      totalSectionsUnderCourse.length,
      userRoadmapId,
      conn
    );

    if (courseResult.affectedRows === 0) {
      throw new Error("Failed to create course progress record for the user.");
    }

    // Step 3: Unlock appropriate modules based on course settings
    await unlockAllModulesOfCourseToUser(
      firstCourse.courseId,
      firstCourse.roadmapCourseId,
      userId,
      firstCourse.isWeeklyUnlock,
      totalSectionsUnderCourse,
      courseResult.insertId,
      conn
    );

    logger.info(
      { userId, courseId: firstCourse.courseId },
      "Successfully enrolled user to first course in roadmap"
    );

    return {
      success: true,
      message: "User successfully enrolled in the first course of the roadmap.",
    };
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

export const unlockAllModulesOfCourseToUser = async (
  courseId,
  roadmapCourseId,
  userId,
  isWeeklyUnlock,
  allSectionsUnderCourse,
  userCourseProgressId,
  conn
) => {
  try {
    if (!courseId || !roadmapCourseId || !userId) {
      throw new Error("Course ID, roadmap course ID, and user ID are required.");
    }

    if (!Array.isArray(allSectionsUnderCourse) || allSectionsUnderCourse.length === 0) {
      throw new Error("No sections provided for module unlocking.");
    }

    if (!userCourseProgressId || typeof userCourseProgressId !== "number") {
      throw new Error("Valid user course progress ID is required.");
    }

    logger.debug(
      {
        courseId,
        roadmapCourseId,
        userId,
        isWeeklyUnlock,
        userCourseProgressId,
        sectionsCount: allSectionsUnderCourse.length,
      },
      "Starting module unlock process"
    );

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
          isWeeklyUnlock,
          userCourseProgressId,
          conn
        );
      },
      { concurrency: 5 } // Limit concurrent operations to prevent database overload
    );

    logger.info(
      { courseId, userId, sectionsProcessed: allSectionsUnderCourse.length },
      "Successfully unlocked all modules for user"
    );

    return {
      success: true,
      message: "All modules of the course have been unlocked for the user.",
    };
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

const processSectionUnlock = async (
  section,
  sectionIndex,
  courseId,
  roadmapCourseId,
  userId,
  isWeeklyUnlock,
  userCourseProgressId,
  conn
) => {
  try {
    logger.debug(
      { sectionId: section.sectionId, sectionIndex, courseId, userCourseProgressId },
      "Processing section unlock"
    );

    // Get all chapters under the current section
    const allChaptersUnderSection = await getAllChaptersUnderSectionQuery(section.sectionId, conn);

    if (allChaptersUnderSection.length === 0) {
      throw new Error(`No chapters found under section ${section.sectionId} of course ${courseId}`);
    }

    // also fetch the quiz or project under the section if applicable and also add them as chapter but as a flag with isQuiz or isProject

    const sectionProgressResult = await insertIntoUserSectionProgressQuery(
      userId,
      roadmapCourseId,
      courseId,
      section.sectionId,
      sectionIndex === 0 ? 1 : 0, // Unlock first section by default
      allChaptersUnderSection.length,
      userCourseProgressId,
      conn
    );

    logger.debug(
      sectionProgressResult,
      `Section progress result for section`
    );

    if (sectionProgressResult.affectedRows === 0) {
      throw new Error(`Failed to unlock section ${section.sectionId} for user ${userId}`);
    }

    logger.debug(
      { sectionId: section.sectionId, unlocked: sectionIndex === 0 },
      "Section processed successfully"
    );

    await Promise.map(allChaptersUnderSection, async (chapter, chapterIndex) => {
      if (chapter.contentType === "quiz") {
        const quizDetails = await getQuizDetailsQuery(chapter.contentRefId, conn);
        if (!quizDetails) {
          return true; // Skip processing if quiz details are not found
        }
        await processChapterProgress(
          chapter,
          chapterIndex,
          sectionIndex,
          userId,
          roadmapCourseId,
          courseId,
          section.sectionId,
          quizDetails.quizMappingId,
          null,
          sectionProgressResult.insertId,
          conn
        );
      } else if (chapter.contentType === "project") {
        const projectDetails = await getProjectDetailsQuery(chapter.contentRefId, conn);
        if (!projectDetails) {
          return true; // Skip processing if quiz details are not found
        }
        await processChapterProgress(
          chapter,
          chapterIndex,
          sectionIndex,
          userId,
          roadmapCourseId,
          courseId,
          section.sectionId,
          null,
          projectDetails.projectMappingId,
          sectionProgressResult.insertId,
          conn
        );
      } else {
        await processChapterProgress(
          chapter,
          chapterIndex,
          sectionIndex,
          userId,
          roadmapCourseId,
          courseId,
          section.sectionId,
          null,
          null,
          sectionProgressResult.insertId,
          conn
        );
      }
    });

    return true;
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

const processChapterProgress = async (
  chapter,
  chapterIndex,
  sectionIndex,
  userId,
  roadmapCourseId,
  courseId,
  sectionId,
  quizMappingId,
  projectMappingId,
  sectionProgressId,
  conn
) => {
  try {
    // First chapter of first section should be unlocked by default
    logger.debug(chapterIndex, sectionIndex, courseId, "Processing chapter progress");
    const shouldUnlockChapter = sectionIndex === 0 && chapterIndex === 0 ? 1 : 0;

    const insertChapterProgressResult = await insertIntoUserChapterProgressQuery(
      userId,
      roadmapCourseId,
      courseId,
      sectionId,
      chapter.chapterId,
      shouldUnlockChapter,
      chapter.chapterDuration,
      chapter.contentType,
      quizMappingId || null,
      projectMappingId || null,
      sectionProgressId,
      conn
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
        sectionProgressId,
      },
      "Chapter progress created successfully"
    );
    return true;
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
