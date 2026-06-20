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
import verifyAdmin from "../../middlewares/verifyAdmin.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All notification routes require authentication
router.use(verifyToken);

// User notification routes
router.get("/", getUserNotifications);
router.get("/settings", getNotificationSettings);
router.put("/settings", updateNotificationSettings);
router.put("/:id/read", markAsRead);
router.put("/read-all", markAllAsRead);
router.delete("/:id", deleteNotification);

// ==================== ADMIN ROUTES ====================
// Admin routes for managing notifications
router.get("/admin/all", verifyAdmin, getAllNotifications);
router.post("/admin/create", verifyAdmin, createNotification);

export default router;