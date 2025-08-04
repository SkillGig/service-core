import logger from "../../../config/logger.js";

export const calculateRecommendedRoadmap = (userResponses) => {
  logger.debug(`Calculating roadmap for user responses`);

  if (!userResponses || userResponses.length === 0) {
    return null;
  }

  // Initialize roadmap scores
  const roadmapScores = {};

  // Process each question's responses
  userResponses.forEach(questionData => {
    const selectedOptionIds = questionData.selectedOptionIds;
    const optionDetails = questionData.optionDetails;

    // Calculate scores for each selected option
    selectedOptionIds.forEach(selectedOptionId => {
      const matchingOptions = optionDetails.filter(opt => opt.optionId === selectedOptionId);
      
      matchingOptions.forEach(option => {
        const roadmapId = option.roadmapId;
        const roadmapName = option.roadmapName;
        const weight = option.weight || 1;

        if (!roadmapScores[roadmapId]) {
          roadmapScores[roadmapId] = {
            roadmapId,
            roadmapName,
            totalScore: 0,
            optionCount: 0
          };
        }

        roadmapScores[roadmapId].totalScore += weight;
        roadmapScores[roadmapId].optionCount += 1;
      });
    });
  });

  // Convert to array and sort by score
  const sortedRoadmaps = Object.values(roadmapScores)
    .sort((a, b) => b.totalScore - a.totalScore);

  if (sortedRoadmaps.length === 0) {
    return null;
  }

  // Find the highest score
  const highestScore = sortedRoadmaps[0].totalScore;

  // Get all roadmaps with the highest score (for tie-breakers)
  const topRoadmaps = sortedRoadmaps.filter(roadmap => roadmap.totalScore === highestScore);

  return {
    recommendedRoadmaps: topRoadmaps,
    isTie: topRoadmaps.length > 1,
    allScores: sortedRoadmaps
  };
};