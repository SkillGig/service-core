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
      quizXpPoints: item.quizXpPoints || null,
      projectXpPoints: item.projectXpPoints || null,
      latestSubmissionId: item.latestSubmissionId || null,
      projectSubmissionStatus: item.projectSubmissionStatus || null,
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
