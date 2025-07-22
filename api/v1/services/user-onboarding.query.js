import { query } from "../../../config/db.js";
import logger from "../../../config/logger.js";

export const getAvailableRoamapsQueryController = async (userId) => {
  logger.debug(userId, `data being received: [getAvailableRoamapsQueryController]`);

  const queryString = `
    SELECT r.id, r.roadmap_name as roadmapName
    FROM roadmaps r
    INNER JOIN org_roadmap_mapping orm ON r.id = orm.roadmap_id
    INNER JOIN users u ON orm.org_id = u.org_id
    WHERE u.id = ? AND r.is_active = 1 AND orm.is_enabled = 1
    ORDER BY r.created_at DESC;`;

  try {
    const result = await query(queryString, [userId]);
    return result;
  } catch (err) {
    logger.error(`Error in getAvailableRoamapsQueryController: ${err.message}`);
    throw err;
  }
};

export const getNextOnboardingQuestion = async (userId, previousQuestionId) => {
  logger.debug(userId, previousQuestionId, `data being received: [getNextOnboardingQuestion]`);

  const questionDetailsQueryString = `
    SELECT q.id,
       q.question_text  as questionText,
       q.question_type  as questionType,
       q.min_selections as minSelections,
       q.max_selections as maxSelections 
    FROM onboarding_questions q
    WHERE q.id > ?
      AND q.is_active = 1
    GROUP BY q.id
    ORDER BY q.id ASC
    LIMIT 1;`;

  // this query should fetch only the options of the roadmaps which are activated for the org that user belongs to

  const optionsQueryString = `
    SELECT DISTINCT oo.id as optionId, oo.option_text as optionText
    FROM onboarding_question_option_roadmap_mapping m
    JOIN onboarding_options oo ON m.option_id = oo.id
    JOIN org_roadmap_mapping orm ON m.roadmap_id = orm.roadmap_id
    JOIN users u ON orm.roadmap_id = u.org_id
    WHERE m.question_id = ? AND m.is_active = 1 AND oo.is_active = 1 AND orm.is_enabled = 1 AND u.id = ?;`;

  try {
    const questionResult = await query(questionDetailsQueryString, [previousQuestionId || 0]);
    if (questionResult.length === 0) {
      return null;
    }

    const question = questionResult[0];
    const optionsResult = await query(optionsQueryString, [question.id, userId]);

    if (optionsResult.length === 0) {
      return null;
    }

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      minSelections: question.minSelections,
      maxSelections: question.maxSelections,
      options: optionsResult,
    };
  } catch (err) {
    logger.error(`Error in getNextOnboardingQuestion: ${err.message}`);
    throw err;
  }
};

export const submitUserResponsesQueryController = async (userId, questionId, responses) => {
  logger.debug(
    userId,
    questionId,
    responses,
    `data being received: [submitUserResponsesQueryController]`
  );

  const queryString = `
    INSERT INTO user_onboarding_responses (user_id, question_id, selected_option_ids)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE selected_option_ids = VALUES(selected_option_ids);`;

  try {
    await query(queryString, [userId, questionId, JSON.stringify(responses)]);
    return { success: true };
  } catch (err) {
    logger.error(`Error in submitUserResponsesQueryController: ${err.message}`);
    throw err;
  }
};

export const getOptionsMappedForQuestion = async (questionId, userId) => {
  logger.debug(questionId, userId, `data being received: [getOptionsMappedForQuestion]`);

  const queryString = `
    SELECT DISTINCT oo.id as optionId, oo.option_text as optionText
    FROM onboarding_question_option_roadmap_mapping m
    JOIN onboarding_options oo ON m.option_id = oo.id
    JOIN org_roadmap_mapping orm ON m.roadmap_id = orm.roadmap_id
    JOIN users u ON orm.roadmap_id = u.org_id
    WHERE m.question_id = ? AND m.is_active = 1 AND oo.is_active = 1 AND orm.is_enabled = 1 AND u.id = ?;`;

  try {
    const result = await query(queryString, [questionId, userId]);
    return result;
  } catch (err) {
    logger.error(`Error in getOptionsMappedForQuestion: ${err.message}`);
    throw err;
  }
};

export const getUserResponsesForRoadmapCalculation = async (userId) => {
  logger.debug(userId, `data being received: [getUserResponsesForRoadmapCalculation]`);

  const queryString = `
    SELECT 
      ur.question_id as questionId,
      ur.selected_option_ids as selectedOptionIds,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'optionId', oo.id,
          'optionText', oo.option_text,
          'weight', oo.weight,
          'roadmapId', m.roadmap_id,
          'roadmapName', r.roadmap_name
        )
      ) as optionDetails
    FROM user_onboarding_responses ur
    JOIN onboarding_question_option_roadmap_mapping m ON FIND_IN_SET(m.option_id, REPLACE(REPLACE(ur.selected_option_ids, '[', ''), ']', ''))
    JOIN onboarding_options oo ON m.option_id = oo.id
    JOIN roadmaps r ON m.roadmap_id = r.id
    JOIN org_roadmap_mapping orm ON r.id = orm.roadmap_id
    JOIN users u ON orm.org_id = u.org_id
    WHERE ur.user_id = ?
      AND m.is_active = 1
      AND oo.is_active = 1
      AND r.is_active = 1
      AND orm.is_enabled = 1
      AND u.id = ?
    GROUP BY ur.question_id, ur.selected_option_ids;`;

  try {
    const result = await query(queryString, [userId, userId]);
    return result;
  } catch (err) {
    logger.error(`Error in getUserResponsesForRoadmapCalculation: ${err.message}`);
    throw err;
  }
};
