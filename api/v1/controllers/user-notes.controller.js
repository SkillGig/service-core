import logger from "../../../config/logger.js";
import { sendApiError, sendApiResponse } from "../helpers/api.helper.js";
import {
  getUserNotesQuery,
  addUserNoteQuery,
  editUserNoteQuery,
} from "../services/user-common.query.js";

export const getUserNotesController = async (req, res) => {
  const userId = req.user.userId;
  const { roadmapCourseId, moduleWeek, sectionId, chapterId } = req.query;
  try {
    const notes = await getUserNotesQuery(
      userId,
      roadmapCourseId,
      moduleWeek,
      sectionId,
      chapterId
    );
    return sendApiResponse(res, notes);
  } catch (error) {
    logger.error(error, `[getUserNotesController]`);
    return sendApiError(res, { notifyUser: error?.message ?? "Failed to fetch notes." }, 500);
  }
};

export const addUserNoteController = async (req, res) => {
  const userId = req.user.userId;
  const { roadmapCourseId, moduleWeek, sectionId, chapterId, noteContent } = req.body;
  if (!noteContent || !roadmapCourseId) {
    return sendApiError(res, { notifyUser: "Note content and roadmapCourseId are required." }, 400);
  }
  try {
    const noteId = await addUserNoteQuery(
      userId,
      roadmapCourseId,
      moduleWeek,
      sectionId,
      chapterId,
      noteContent
    );
    return sendApiResponse(res, { noteId });
  } catch (error) {
    logger.error(error, `[addUserNoteController]`);
    return sendApiError(res, { notifyUser: error?.message ?? "Failed to add note." }, 500);
  }
};

export const editUserNoteController = async (req, res) => {
  const userId = req.user.userId;
  const { noteId, noteContent } = req.body;
  if (!noteId || !noteContent) {
    return sendApiError(res, { notifyUser: "Note ID and content are required." }, 400);
  }
  try {
    await editUserNoteQuery(userId, noteId, noteContent);
    return sendApiResponse(res, { success: true });
  } catch (error) {
    logger.error(error, `[editUserNoteController]`);
    return sendApiError(res, { notifyUser: error?.message ?? "Failed to update note." }, 500);
  }
};
