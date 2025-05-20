import { Router } from "express";
import { authenticateUserTokenMiddleware } from "../middlewares/user.handler.js";
import {
  getAllUserNotifications,
  markNotificationsAsSeen,
} from "../controllers/user-common.controller.js";
import UserStreaksRoutes from "./user-streak.routes.js";

const router = Router();

router.use("/streaks", UserStreaksRoutes);

router.get(
  "/notifications/all",
  authenticateUserTokenMiddleware,
  getAllUserNotifications
);

router.patch(
  "/notifications/mark-as-seen",
  authenticateUserTokenMiddleware,
  markNotificationsAsSeen
);

export default router;
