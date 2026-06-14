// routes/notification.routes.js
import { Router } from "express";
import {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationSettings,
  updateNotificationSettings,
  getAllNotifications,
} from "../../controllers/notification/notification.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
router.use(verifyToken);

// User routes
router.get("/", getUserNotifications);
router.get("/settings", getNotificationSettings);
router.put("/settings", updateNotificationSettings);
router.put("/:id/read", markAsRead);
router.put("/read-all", markAllAsRead);
router.delete("/:id", deleteNotification);

// Admin routes
router.get("/admin/all", getAllNotifications);
router.post("/admin/create", createNotification);

export default router;