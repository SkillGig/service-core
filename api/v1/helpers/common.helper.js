export const ordinalSuffix = (day) => {
  const d = parseInt(day);
  if (d > 3 && d < 21) return "th";
  switch (d % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

export const transformRoadmapData = (roadmapDetails) => {
  if (!roadmapDetails || roadmapDetails.length === 0) {
    return null;
  }

  // Get the first item to extract roadmap info
  const firstItem = roadmapDetails[0];

  // Transform course data
  const transformCourse = (course) => ({
    courseId: course.course_id,
    courseTitle: course.course_title,
    thumbnailUrl: course.thumbnail_url,
    tutor: course.tutor_name,
    tags: course.tags ? course.tags.split(",").map((tag) => tag.trim()) : [],
    rating: course.rating ? parseFloat(course.rating) : null,
    enrolledCount: course.enrolled_count || 0,
    isUserEnrolled: false,
  });

  // Categorize courses by level
  const categories = {
    starterKit: [],
    levels: {
      beginner: [],
      intermediate: [],
      advanced: [],
    },
    addOns: [],
  };

  roadmapDetails.forEach((course) => {
    const transformedCourse = transformCourse(course);

    switch (course.level) {
      case "starter-kit":
        categories.starterKit.push(transformedCourse);
        break;
      case "beginner":
        categories.levels.beginner.push(transformedCourse);
        break;
      case "intermediate":
        categories.levels.intermediate.push(transformedCourse);
        break;
      case "advanced":
        categories.levels.advanced.push(transformedCourse);
        break;
      case "add-on":
        categories.addOns.push(transformedCourse);
        break;
    }
  });

  return {
    roadmapId: firstItem.roadmap_id,
    roadmapTitle: firstItem.roadmap_name,
    categories,
  };
};

export const transformModuleData = (moduleData) => {
  if (!moduleData || !moduleData.details || moduleData.details.length === 0) {
    return { modules: [] };
  }

  // Group by module_week first
  const moduleGroups = {};

  moduleData.details.forEach((item) => {
    const moduleWeek = item.module_week;
    if (!moduleGroups[moduleWeek]) {
      moduleGroups[moduleWeek] = {};
    }
    const sectionId = item.sectionId;
    if (!moduleGroups[moduleWeek][sectionId]) {
      moduleGroups[moduleWeek][sectionId] = {
        sectionId: sectionId,
        title: item.sectionTitle,
        description: item.sectionDescription,
        order: item.sectionOrder,
        chapters: [],
      };
    }

    // Build chapter object with quiz/project details if present
    let chapter = {
      chapterId: item.chapterId,
      title: item.chapterTitle,
      type: item.contentType,
      duration: parseInt(item.chapterDuration) || 0,
    };
    if (item.contentType === "quiz") {
      chapter = {
        ...chapter,
        quizId: item.quizId,
        quizTitle: item.quizTitle,
        quizDescription: item.quizDescription,
        totalQuestions: item.totalQuestions,
        quizDuration: item.quizDuration,
      };
    }
    if (item.contentType === "project") {
      chapter = {
        ...chapter,
        projectId: item.projectId,
        projectTitle: item.projectTitle,
        projectDescription: item.projectDescription,
        projectDuration: item.projectDuration,
      };
    }
    moduleGroups[moduleWeek][sectionId].chapters.push(chapter);
  });

  // Transform to final structure with calculations
  const modules = Object.keys(moduleGroups)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((moduleWeek) => {
      const sections = Object.values(moduleGroups[moduleWeek])
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          // Calculate section duration by summing all chapter durations in this section
          const sectionDuration = section.chapters.reduce(
            (total, chapter) => total + chapter.duration,
            0
          );
          return {
            sectionId: section.sectionId,
            title: section.title,
            description: section.description,
            duration: sectionDuration,
            chapters: section.chapters,
          };
        });

      // Calculate module-level statistics
      const totalDurationOfModule = sections.reduce(
        (total, section) => total + section.duration,
        0
      );
      const totalSectionsUnderModule = sections.length;
      let totalVideosUnderModule = 0;
      let totalDocsUnderModule = 0;
      let totalQuizzesUnderModule = 0;
      let totalProjectsUnderModule = 0;
      sections.forEach((section) => {
        section.chapters.forEach((chapter) => {
          switch (chapter.type) {
            case "video":
              totalVideosUnderModule++;
              break;
            case "document":
            case "doc":
              totalDocsUnderModule++;
              break;
            case "quiz":
              totalQuizzesUnderModule++;
              break;
            case "project":
              totalProjectsUnderModule++;
              break;
          }
        });
      });
      return {
        moduleWeek: parseInt(moduleWeek),
        totalDurationOfModule,
        totalSectionsUnderModule,
        totalVideosUnderModule,
        totalDocsUnderModule,
        totalQuizzesUnderModule,
        totalProjectsUnderModule,
        sections,
      };
    });

  return { summary: moduleData.summary, modules };
};

export const transformCourseSummary = (summaryArr) => {
  let totalVideos = 0,
    completedVideos = 0;
  let totalReadings = 0,
    completedReadings = 0;
  let totalQuizzes = 0,
    completedQuizzes = 0;
  let totalModulePercent = 0;
  let moduleCount = summaryArr.length;
  let currentModule = null;

  summaryArr.forEach((module) => {
    totalVideos += module.totalVideos;
    completedVideos += module.completedVideos;
    totalReadings += module.totalReadings;
    completedReadings += module.completedReadings;
    totalQuizzes += module.totalQuizzes;
    completedQuizzes += module.completedQuizzes;
    totalModulePercent += module.moduleCompletionPercent;

    if (!currentModule && module.status === "in-progress") {
      currentModule = module;
    }
  });

  const overallCompletionPercent =
    moduleCount > 0 ? Math.round(totalModulePercent / moduleCount) : 0;
  const overallVideosPercent =
    totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;
  const overallReadingsPercent =
    totalReadings > 0 ? Math.round((completedReadings / totalReadings) * 100) : 0;
  const overallQuizzesPercent =
    totalQuizzes > 0 ? Math.round((completedQuizzes / totalQuizzes) * 100) : 0;

  return {
    modules: summaryArr,
    overall: {
      totalVideos,
      completedVideos,
      overallVideosPercent,
      totalReadings,
      completedReadings,
      overallReadingsPercent,
      totalQuizzes,
      completedQuizzes,
      overallQuizzesPercent,
      overallCompletionPercent,
    },
    currentModule,
  };
};

export const transformModuleDetails = (data) => {
  if (!Array.isArray(data) || data.length === 0) return { sections: [], overallSummary: {} };

  // Group chapters by section
  const sectionMap = {};
  let latestUnlockedAt = null;
  let currentSectionId = null;
  let currentChapterId = null;
  let moduleUnlockedStatus = false;

  data.forEach((item) => {
    if (!sectionMap[item.courseSectionId]) {
      sectionMap[item.courseSectionId] = {
        sectionId: item.courseSectionId,
        sectionTitle: item.sectionTitle,
        sectionDescription: item.sectionDescription,
        chapters: [],
        sectionTotalChapters: item.sectionTotalChapters,
      };
    }
    sectionMap[item.courseSectionId].chapters.push({
      chapterId: item.chapterId,
      contentType: item.contentType,
      chapterTitle: item.chapterTitle,
      chapterDescription: item.chapterDescription,
      watchedDuration: item.watchedDuration,
      totalDuration: item.totalDuration,
      isUnlocked: item.isChapterUnlocked,
      unlockedAt: item.unlockedAt,
      isCompleted: item.isCompleted,
      completionPercent: item.completionPercent,
      contentRefId: item.contentRefId,
      // Quiz details
      quizXpPoints: item.quizXpPoints || null,
      quizMappingId: item.quizMappingId || null,
      currentQuizAttempt: item.currentQuizAttemptId
        ? {
            attemptId: item.quizAttemptId,
            score: item.quizScore,
            totalPoints: item.quizTotalPoints,
            status: item.quizAttemptStatus,
            startedAt: item.quizStartedAt,
            completedAt: item.quizCompletedAt,
          }
        : null,
      // Project details
      projectXpPoints: item.projectXpPoints || null,
      projectMappingId: item.projectMappingId || null,
      latestProjectSubmission: item.latestProjectSubmissionId
        ? {
            submissionId: item.projectSubmissionId,
            attemptNumber: item.projectAttemptNumber,
            githubUrl: item.projectGithubUrl,
            docUrl: item.projectDocUrl,
            deployedUrl: item.projectDeployedUrl,
            submissionComment: item.projectSubmissionComment,
            status: item.projectSubmissionStatus,
            tutorComment: item.projectTutorComment,
            reviewedBy: item.projectReviewedBy,
            submittedAt: item.projectSubmittedAt,
            reviewedAt: item.projectReviewedAt,
          }
        : null,
    });

    // Find the most recently unlocked chapter
    if (item.unlockedAt) {
      if (!latestUnlockedAt || new Date(item.unlockedAt) > new Date(latestUnlockedAt)) {
        latestUnlockedAt = item.unlockedAt;
        currentSectionId = item.courseSectionId;
        currentChapterId = item.chapterId;
        moduleUnlockedStatus = true;
      }
    }
  });

  // Build sections array with sectionOverallSummary
  const sections = Object.values(sectionMap).map((section) => {
    const totalChapters = section.chapters.length;
    const completedChapters = section.chapters.filter((ch) => ch.isCompleted).length;
    const sectionCompletionPercent =
      totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
    const isUnlocked = section.chapters.some((ch) => ch.isUnlocked);
    const isCompleted = completedChapters === totalChapters && totalChapters > 0;

    return {
      ...section,
      sectionOverallSummary: {
        totalChapters,
        completedChapters,
        sectionCompletionPercent,
        isUnlocked,
        isCompleted,
      },
    };
  });

  return {
    sections,
    overallSummary: {
      currentSectionId,
      currentChapterId,
      latestUnlockedAt,
      moduleUnlockedStatus,
    },
  };
};

export const transformAllModuleDetails = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return { modules: [], overallSummary: {} };
  }

  // Group data by module week first
  const moduleMap = {};
  let latestUnlockedAt = null;
  let currentModuleWeek = null;
  let currentSectionId = null;
  let currentChapterId = null;
  let moduleUnlockedStatus = false;

  data.forEach((item) => {
    const moduleWeek = item.moduleWeek;

    if (!moduleMap[moduleWeek]) {
      moduleMap[moduleWeek] = {};
    }

    if (!moduleMap[moduleWeek][item.courseSectionId]) {
      moduleMap[moduleWeek][item.courseSectionId] = {
        sectionId: item.courseSectionId,
        sectionTitle: item.sectionTitle,
        sectionDescription: item.sectionDescription,
        chapters: [],
        sectionTotalChapters: item.sectionTotalChapters,
      };
    }

    moduleMap[moduleWeek][item.courseSectionId].chapters.push({
      chapterId: item.chapterId,
      contentType: item.contentType,
      chapterTitle: item.chapterTitle,
      chapterDescription: item.chapterDescription,
      watchedDuration: item.watchedDuration,
      totalDuration: item.totalDuration,
      isUnlocked: item.isChapterUnlocked,
      unlockedAt: item.unlockedAt,
      isCompleted: item.isCompleted,
      completionPercent: item.completionPercent,
      contentRefId: item.contentRefId,
      // Quiz details
      quizXpPoints: item.quizXpPoints || null,
      quizMappingId: item.quizMappingId || null,
      currentQuizAttempt: item.currentQuizAttemptId
        ? {
            attemptId: item.quizAttemptId,
            score: item.quizScore,
            totalPoints: item.quizTotalPoints,
            status: item.quizAttemptStatus,
            startedAt: item.quizStartedAt,
            completedAt: item.quizCompletedAt,
          }
        : null,
      // Project details
      projectXpPoints: item.projectXpPoints || null,
      projectMappingId: item.projectMappingId || null,
      latestProjectSubmission: item.latestProjectSubmissionId
        ? {
            submissionId: item.projectSubmissionId,
            attemptNumber: item.projectAttemptNumber,
            githubUrl: item.projectGithubUrl,
            docUrl: item.projectDocUrl,
            deployedUrl: item.projectDeployedUrl,
            submissionComment: item.projectSubmissionComment,
            status: item.projectSubmissionStatus,
            tutorComment: item.projectTutorComment,
            reviewedBy: item.projectReviewedBy,
            submittedAt: item.projectSubmittedAt,
            reviewedAt: item.projectReviewedAt,
          }
        : null,
    });

    // Find the most recently unlocked chapter across all modules
    if (item.unlockedAt) {
      if (!latestUnlockedAt || new Date(item.unlockedAt) > new Date(latestUnlockedAt)) {
        latestUnlockedAt = item.unlockedAt;
        currentModuleWeek = moduleWeek;
        currentSectionId = item.courseSectionId;
        currentChapterId = item.chapterId;
        moduleUnlockedStatus = true;
      }
    }
  });

  // Build modules array with sections and their summaries
  const modules = Object.keys(moduleMap)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((moduleWeek) => {
      const sections = Object.values(moduleMap[moduleWeek]).map((section) => {
        const totalChapters = section.chapters.length;
        const completedChapters = section.chapters.filter((ch) => ch.isCompleted).length;
        const sectionCompletionPercent =
          totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
        const isUnlocked = section.chapters.some((ch) => ch.isUnlocked);
        const isCompleted = completedChapters === totalChapters && totalChapters > 0;

        return {
          ...section,
          sectionOverallSummary: {
            totalChapters,
            completedChapters,
            sectionCompletionPercent,
            isUnlocked,
            isCompleted,
          },
        };
      });

      // Calculate module-level statistics
      const totalSections = sections.length;
      const completedSections = sections.filter(
        (section) => section.sectionOverallSummary.isCompleted
      ).length;
      const moduleCompletionPercent =
        totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
      const isModuleUnlocked = sections.some((section) => section.sectionOverallSummary.isUnlocked);
      const isModuleCompleted = completedSections === totalSections && totalSections > 0;

      return {
        moduleWeek: parseInt(moduleWeek),
        sections,
        moduleOverallSummary: {
          totalSections,
          completedSections,
          moduleCompletionPercent,
          isModuleUnlocked,
          isModuleCompleted,
        },
      };
    });

  return {
    modules,
    overallSummary: {
      currentModuleWeek,
      currentSectionId,
      currentChapterId,
      latestUnlockedAt,
      moduleUnlockedStatus,
    },
  };
};

export const transformAllModuleDetailsForNotEnrolledCourse = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return { modules: [], overallSummary: {} };
  }

  // Group data by module week first
  const moduleMap = {};

  data.forEach((item) => {
    const moduleWeek = item.moduleWeek || item.module_week || 1; // Handle both field names with fallback
    
    if (!moduleMap[moduleWeek]) {
      moduleMap[moduleWeek] = {};
    }

    if (!moduleMap[moduleWeek][item.sectionId]) {
      moduleMap[moduleWeek][item.sectionId] = {
        sectionId: item.sectionId,
        sectionTitle: item.sectionTitle,
        sectionDescription: item.sectionDescription,
        chapters: [],
        sectionTotalChapters: 0, // Will be calculated below
      };
    }

    moduleMap[moduleWeek][item.sectionId].chapters.push({
      chapterId: item.chapterId,
      contentType: item.contentType,
      chapterTitle: item.chapterTitle,
      chapterDescription: item.chapterDescription || null, // Use actual description if available
      watchedDuration: item.watchedDuration || 0, // Use actual value from query
      totalDuration: item.totalDuration || item.chapterDuration || 0, // Handle both field names
      isUnlocked: Boolean(item.isChapterUnlocked || item.isUnlocked), // Handle both field names and convert to boolean
      unlockedAt: item.unlockedAt || null,
      isCompleted: Boolean(item.isCompleted), // Convert to boolean
      completionPercent: item.completionPercent || 0,
      contentRefId: item.contentRefId || null,
      // Quiz details with actual data from query
      quizXpPoints: item.quizXpPoints || null,
      quizMappingId: item.quizMappingId || null,
      currentQuizAttempt: item.currentQuizAttemptId ? {
        attemptId: item.quizAttemptId,
        score: item.quizScore,
        totalPoints: item.quizTotalPoints,
        status: item.quizAttemptStatus,
        startedAt: item.quizStartedAt,
        completedAt: item.quizCompletedAt,
      } : null,
      // Project details with actual data from query
      projectXpPoints: item.projectXpPoints || null,
      projectMappingId: item.projectMappingId || null,
      latestProjectSubmission: item.latestProjectSubmissionId ? {
        submissionId: item.projectSubmissionId,
        attemptNumber: item.projectAttemptNumber,
        githubUrl: item.projectGithubUrl,
        docUrl: item.projectDocUrl,
        deployedUrl: item.projectDeployedUrl,
        submissionComment: item.projectSubmissionComment,
        status: item.projectSubmissionStatus,
        tutorComment: item.projectTutorComment,
        reviewedBy: item.projectReviewedBy,
        submittedAt: item.projectSubmittedAt,
        reviewedAt: item.projectReviewedAt,
      } : null,
    });
  });

  // Calculate sectionTotalChapters for each section
  Object.keys(moduleMap).forEach((moduleWeek) => {
    Object.keys(moduleMap[moduleWeek]).forEach((sectionId) => {
      moduleMap[moduleWeek][sectionId].sectionTotalChapters =
        moduleMap[moduleWeek][sectionId].chapters.length;
    });
  });

  // Build modules array with sections and their summaries
  const modules = Object.keys(moduleMap)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((moduleWeek) => {
      const sections = Object.values(moduleMap[moduleWeek]).map((section) => {
        const totalChapters = section.chapters.length;
        const completedChapters = section.chapters.filter((ch) => ch.isCompleted).length;
        const sectionCompletionPercent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
        const isUnlocked = section.chapters.some((ch) => ch.isUnlocked);
        const isCompleted = completedChapters === totalChapters && totalChapters > 0;

        return {
          ...section,
          sectionOverallSummary: {
            totalChapters,
            completedChapters,
            sectionCompletionPercent,
            isUnlocked,
            isCompleted,
          },
        };
      });

      // Calculate module-level statistics
      const totalSections = sections.length;
      const completedSections = sections.filter((section) => section.sectionOverallSummary.isCompleted).length;
      const moduleCompletionPercent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
      const isModuleUnlocked = sections.some((section) => section.sectionOverallSummary.isUnlocked);
      const isModuleCompleted = completedSections === totalSections && totalSections > 0;

      return {
        moduleWeek: parseInt(moduleWeek),
        sections,
        moduleOverallSummary: {
          totalSections,
          completedSections,
          moduleCompletionPercent,
          isModuleUnlocked,
          isModuleCompleted,
        },
      };
    });

  // Find latest unlocked info for overall summary
  let latestUnlockedAt = null;
  let currentModuleWeek = null;
  let currentSectionId = null;
  let currentChapterId = null;
  let moduleUnlockedStatus = false;

  modules.forEach((module) => {
    module.sections.forEach((section) => {
      section.chapters.forEach((chapter) => {
        if (chapter.unlockedAt) {
          if (!latestUnlockedAt || new Date(chapter.unlockedAt) > new Date(latestUnlockedAt)) {
            latestUnlockedAt = chapter.unlockedAt;
            currentModuleWeek = module.moduleWeek;
            currentSectionId = section.sectionId;
            currentChapterId = chapter.chapterId;
            moduleUnlockedStatus = true;
          }
        }
      });
    });
  });

  return {
    modules,
    overallSummary: {
      currentModuleWeek,
      currentSectionId,
      currentChapterId,
      latestUnlockedAt,
      moduleUnlockedStatus,
    },
  };
};