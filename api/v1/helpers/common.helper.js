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

    // Add chapter to section
    moduleGroups[moduleWeek][sectionId].chapters.push({
      chapterId: item.chapterId,
      title: item.chapterTitle,
      type: item.contentType,
      duration: parseInt(item.chapterDuration) || 0,
    });
  });

  // Transform to final structure with calculations
  const modules = Object.keys(moduleGroups)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((moduleWeek) => {
      const sections = Object.values(moduleGroups[moduleWeek])
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          // Calculate section duration by summing all chapter durations in this section
          const sectionDuration = section.chapters.reduce((total, chapter) => total + chapter.duration, 0);
          
          return {
            sectionId: section.sectionId,
            title: section.title,
            description: section.description,
            duration: sectionDuration,
            chapters: section.chapters,
          };
        });

      // Calculate module-level statistics
      const totalDurationOfModule = sections.reduce((total, section) => total + section.duration, 0);
      const totalSectionsUnderModule = sections.length;
      
      let totalVideosUnderModule = 0;
      let totalDocsUnderModule = 0;
      let totalQuizzesUnderModule = 0;
      
      sections.forEach(section => {
        section.chapters.forEach(chapter => {
          switch (chapter.type) {
            case 'video':
              totalVideosUnderModule++;
              break;
            case 'document':
            case 'doc':
              totalDocsUnderModule++;
              break;
            case 'quiz':
              totalQuizzesUnderModule++;
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
        sections,
      };
    });

  return { summary: moduleData.summary, modules };
};
