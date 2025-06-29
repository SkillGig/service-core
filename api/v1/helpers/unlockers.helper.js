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
  getPreviousSectionStatusQuery,
  getAllChaptersUnderSectionForUserQuery,
  markUnlockChapterToUserQuery,
  getAllModuleDetailsQuery,
  markUnlockSectionToUserQuery,
  getPreviousChapterStatusQuery,
} from "../services/user-common.query.js";
import { getConnection, queryWithConn } from "../../../config/db.js";

const Promise = Bluebird;

export const enrollUserToTheCourseInRoadmap = async (
  courseToEnroll,
  userId,
  userRoadmapId,
  conn
) => {
  try {
    // Validate input parameters
    if (!Array.isArray(courseToEnroll) || courseToEnroll.length === 0 || !userRoadmapId) {
      throw new Error("No courses available in the roadmap to enroll.");
    }

    if (!userId || typeof userId !== "number") {
      throw new Error("Valid user ID is required for enrollment.");
    }

    logger.debug(
      {
        userId,
        courseId: courseToEnroll.courseId,
        roadmapCourseId: courseToEnroll.roadmapCourseId,
      },
      "Starting enrollment process for first course in roadmap"
    );

    // Check if the user is already enrolled in the first course
    const isUserAlreadyEnrolled = await checkIfCourseIsAlreadyEnrolledToCourseQuery(
      userId,
      courseToEnroll.roadmapCourseId,
      conn
    );

    if (isUserAlreadyEnrolled) {
      logger.info(
        { userId, roadmapCourseId: courseToEnroll.roadmapCourseId },
        "User is already enrolled in the first course"
      );
      return {
        success: true,
        message: "User is already enrolled in the first course of the roadmap.",
      };
    }

    // Step 1: Get all sections under the course
    const totalSectionsUnderCourse = await getAllSectionsUnderCourseQuery(
      courseToEnroll.courseId,
      conn
    );

    if (totalSectionsUnderCourse.length === 0) {
      throw new Error("No sections found under the first course of the roadmap.");
    }

    // Step 2: Create course progress record
    const courseResult = await insertUserCourseProgressQuery(
      userId,
      courseToEnroll.roadmapCourseId,
      courseToEnroll.courseId,
      totalSectionsUnderCourse.length,
      userRoadmapId,
      conn
    );

    if (courseResult.affectedRows === 0) {
      throw new Error("Failed to create course progress record for the user.");
    }

    // Step 3: Unlock appropriate modules based on course settings
    await unlockAllModulesOfCourseToUser(
      courseToEnroll.courseId,
      courseToEnroll.roadmapCourseId,
      userId,
      courseToEnroll.isWeeklyUnlock,
      totalSectionsUnderCourse,
      courseResult.insertId,
      conn
    );

    logger.info(
      { userId, courseId: courseToEnroll.courseId },
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
        courseId: courseToEnroll?.courseId,
      },
      "[enrollUserToTheCourseInRoadmap] Enrollment failed"
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
      section.moduleWeek,
      conn
    );

    logger.debug(sectionProgressResult, `Section progress result for section`);

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

export const unlockModuleOfCourseToTheUser = async (userId, roadmapCourseId, moduleId, conn) => {
  if (!userId || !roadmapCourseId || !moduleId) {
    throw new Error("userId and roadmapCourseId and moduleId are required.");
  }

  try {
    // check if the module is already unlocked for the user
    const allModuleDetails = await getAllModuleDetailsQuery(roadmapCourseId, userId, conn);
    if (moduleId === 1) {
      const firstModule = allModuleDetails.find((module) => module.moduleWeek === 1);
      logger.debug(firstModule, `data being received: [functionName]`);
      if (firstModule && firstModule.isSectionUnlocked) {
        await queryWithConn(conn, "ROLLBACK");
        conn.release();
        throw new Error("Module 1 is already unlocked for the user");
      }
      // if the first module is not unlocked, then unlock it for the user
      await queryWithConn(conn, "START TRANSACTION");
      const unlockResult = await unlockSectionUnderCourse(
        roadmapCourseId,
        userId,
        firstModule.sectionId,
        conn
      );
      if (!unlockResult.success) {
        await queryWithConn(conn, "ROLLBACK");
        conn.release();
        throw new Error(unlockResult.message);
      }
      await queryWithConn(conn, "COMMIT");
      conn.release();
      logger.info(
        { userId, roadmapCourseId, moduleId },
        `Module ${moduleId} unlocked successfully for user ${userId}`
      );
      return {
        success: true,
        message: `Module ${moduleId} unlocked successfully for user ${userId}`,
      };
    } else {
      // check if the previous module sections are completed
      const previousModule = allModuleDetails.filter(
        (module) => module.moduleWeek === moduleId - 1
      );
      // for all the sections in the previous module, check if they are completed
      const isPreviousModuleCompleted = previousModule.every(
        (section) => section.isSectionCompleted === 1
      );

      const roadmapCourseDetails = await getPrerequisiteCourseQuery(roadmapCourseId, conn);

      const lastSectionOfPreviousModule = previousModule[previousModule.length - 1];
      const lastSectionCompletedAt = new Date(lastSectionOfPreviousModule.sectionCompletedAt);
      const currentDate = new Date();
      const sevenDaysAgo = new Date(currentDate);
      sevenDaysAgo.setDate(currentDate.getDate() - 7);
      // if the last section of the previous module is not completed or completed less than 7 days ago, then throw an error
      if (
        !isPreviousModuleCompleted ||
        (roadmapCourseDetails.isWeeklyUnlock && lastSectionCompletedAt > sevenDaysAgo)
      ) {
        await queryWithConn(conn, "ROLLBACK");
        conn.release();
        throw new Error(
          `Cannot unlock module ${moduleId} until the last section of module ${
            moduleId - 1
          } is completed and more than 7 days have passed since its completion.`
        );
      }

      const currentModule = allModuleDetails.filter((module) => module.moduleWeek === moduleId);
      // check if the first section of the current module is already unlocked
      logger.debug(currentModule, `data being received: [unlockModuleOfCourseToTheUser]`);
      const isModuleUnlocked = currentModule[0]?.isSectionUnlocked === 1 ? true : false;
      if (isModuleUnlocked) {
        await queryWithConn(conn, "ROLLBACK");
        conn.release();
        throw new Error("Module is already unlocked for the user");
      }

      await queryWithConn(conn, "START TRANSACTION");
      // unlock the module for the user
      const currentSectionUnderModule = currentModule[0];
      const unlockResult = await unlockSectionUnderCourse(
        roadmapCourseId,
        userId,
        currentSectionUnderModule.sectionId,
        conn
      );
      if (!unlockResult.success) {
        await queryWithConn(conn, "ROLLBACK");
        conn.release();
        throw new Error(unlockResult.message);
      }

      await queryWithConn(conn, "COMMIT");
      conn.release();
      logger.info(
        { userId, roadmapCourseId, moduleId },
        `Module ${moduleId} unlocked successfully for user ${userId}`
      );
      return {
        success: true,
        message: `Module ${moduleId} unlocked successfully for user ${userId}`,
      };
    }
  } catch (error) {
    if (conn) {
      await queryWithConn(conn, "ROLLBACK");
      conn.release();
    }
    logger.error(error, `error being received: [unlockModuleOfCourseToTheUser]`);
    throw new Error(`Failed to unlock module ${moduleId} for user ${userId}: ${error.message}`);
  }
};

export const unlockSectionUnderCourse = async (userId, roadmapCourseId, sectionId, conn) => {
  try {
    if (!roadmapCourseId || !userId || !sectionId) {
      throw new Error("roadmapCourseId, userId, and sectionId are required.");
    }

    logger.debug({ roadmapCourseId, userId, sectionId }, "Starting section unlock process");

    // check if the previous section is already unlocked
    const previousSectionDetails = await getPreviousSectionStatusQuery(
      userId,
      roadmapCourseId,
      sectionId,
      conn
    );

    // if there are no previous sections, we can unlock the section directly
    // check if all the previous sections are unlocked and completed
    const allPreviousSectionsUnlocked =
      previousSectionDetails.length === 0
        ? true
        : previousSectionDetails.every(
            (section) => section.isUnlocked === 1 && section.isCompleted === 1
          );
    if (!allPreviousSectionsUnlocked) {
      throw new Error("Cannot unlock this section until all previous sections are completed.");
    }
    logger.debug({ previousSectionDetails }, "Previous section status checked successfully");
    // Proceed to unlock the section
    const sectionUnlockResult = await markUnlockSectionToUserQuery(
      userId,
      roadmapCourseId,
      sectionId,
      1,
      conn
    );

    if (sectionUnlockResult.affectedRows === 0) {
      throw new Error(`Failed to unlock section ${sectionId} for user ${userId}`);
    }

    const getAllChaptersUnderSection = await getAllChaptersUnderSectionForUserQuery(
      userId,
      roadmapCourseId,
      sectionId,
      conn
    );
    if (getAllChaptersUnderSection.length === 0) {
      throw new Error(`No chapters found under section ${sectionId} for user ${userId}`);
    }
    // mark the first chapter of the section as unlocked
    const firstChapter = getAllChaptersUnderSection[0];
    const firstChapterUnlockResult = await unlockChapterToUserUnderCourseQuery(
      userId,
      roadmapCourseId,
      firstChapter.chapterId,
      sectionId,
      conn
    );
    if (!firstChapterUnlockResult.success) {
      throw new Error(
        `Failed to unlock first chapter ${firstChapter.chapterId} of section ${sectionId} for user ${userId}: ${firstChapterUnlockResult.message}`
      );
    }

    logger.debug(
      { sectionId, userId, roadmapCourseId, firstChapterId: firstChapter.chapterId },
      "Section and first chapter unlocked successfully"
    );

    return {
      success: true,
      message: `Section ${sectionId} and first chapter ${firstChapter.chapterId} unlocked successfully for user ${userId}`,
    };
  } catch (error) {
    logger.error(
      {
        error: error.message,
        roadmapCourseId,
        userId,
        sectionId,
      },
      "[unlockSectionUnderCourse] Section unlocking failed"
    );
    throw error;
  }
};

export const unlockChapterToUserUnderCourse = async (
  userId,
  roadmapCourseId,
  sectionId,
  chapterId,
  conn
) => {
  try {
    if (!userId || !roadmapCourseId || !chapterId || !sectionId) {
      throw new Error("userId, roadmapCourseId, chapterId, and sectionId are required.");
    }

    logger.debug(
      { userId, roadmapCourseId, chapterId, sectionId },
      "Starting chapter unlock process"
    );

    const previousChapterDetails = await getPreviousChapterStatusQuery(
      userId,
      roadmapCourseId,
      chapterId,
      conn
    );

    const allPreviousChaptersUnlocked =
      previousChapterDetails.length === 0
        ? true
        : previousChapterDetails.every(
            (chapter) => chapter.isChapterUnlocked === 1 && chapter.isChapterCompleted === 1
          );
    if (!allPreviousChaptersUnlocked) {
      throw new Error("Cannot unlock this chapter until all previous chapters are completed.");
    }
    logger.debug({ previousChapterDetails }, "Previous chapter status checked successfully");

    // Proceed to unlock the chapter
    const chapterUnlockResult = await markUnlockChapterToUserQuery(
      userId,
      roadmapCourseId,
      sectionId,
      chapterId,
      1,
      conn
    );
    if (chapterUnlockResult.affectedRows === 0) {
      throw new Error(`Failed to unlock chapter ${chapterId} for user ${userId}`);
    }
    logger.debug(
      { chapterId, userId, roadmapCourseId, sectionId },
      "Chapter unlocked successfully"
    );
    return {
      success: true,
      message: `Chapter ${chapterId} unlocked successfully for user ${userId}`,
    };
  } catch (error) {
    logger.error(
      {
        error: error.message,
        userId,
        roadmapCourseId,
        chapterId,
        sectionId,
      },
      "[unlockChapterToUserUnderCourse] Chapter unlocking failed"
    );
    throw error;
  }
};
