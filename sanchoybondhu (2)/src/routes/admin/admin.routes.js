import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  updateKycStatus,
  getKycApplications,
  getAdminDashboardStats,
  getAllSupportTicketsAdmin,
  adminReplyToTicket,
  getTicketWithRepliesAdmin,
  sendBulkNotification,
  getNotificationLogs,
  getReportsData,
  getAnalyticsData,
  getSavingsData,
  getRevenueData,
  getSecurityEvents,
  getFraudAlerts,
  getPlatformSettings,
  updatePlatformSettings,
  getCmsContent,
  updateCmsContent,
  getAllTransactions,
} from "../../controllers/admin/admin.controller.js";
import verifyAdmin from "../../middlewares/verifyAdmin.js";

const router = Router();

// ==================== ADMIN ROUTES ====================
// All routes require admin role

// Dashboard stats
router.get("/dashboard", verifyAdmin, getAdminDashboardStats);

// User management
router.get("/users", verifyAdmin, getAllUsers);
router.get("/users/:id", verifyAdmin, getUserById);
router.patch("/users/:id/status", verifyAdmin, updateUserStatus);
router.patch("/users/:id/role", verifyAdmin, updateUserRole);

// KYC management
router.get("/kyc", verifyAdmin, getKycApplications);
router.patch("/users/:id/kyc", verifyAdmin, updateKycStatus);

// Support tickets
router.get("/tickets", verifyAdmin, getAllSupportTicketsAdmin);
router.get("/tickets/:ticketId", verifyAdmin, getTicketWithRepliesAdmin);
router.post("/tickets/:ticketId/reply", verifyAdmin, adminReplyToTicket);

// Notifications
router.post("/notifications/send", verifyAdmin, sendBulkNotification);
router.get("/notifications/logs", verifyAdmin, getNotificationLogs);

// Reports & Analytics
router.get("/reports", verifyAdmin, getReportsData);
router.get("/analytics", verifyAdmin, getAnalyticsData);

// Savings & Revenue
router.get("/savings", verifyAdmin, getSavingsData);
router.get("/revenue", verifyAdmin, getRevenueData);

// Security & Fraud
router.get("/security/events", verifyAdmin, getSecurityEvents);
router.get("/fraud/alerts", verifyAdmin, getFraudAlerts);

// Settings & CMS
router.get("/settings", verifyAdmin, getPlatformSettings);
router.put("/settings", verifyAdmin, updatePlatformSettings);
router.get("/cms", verifyAdmin, getCmsContent);
router.put("/cms", verifyAdmin, updateCmsContent);

// Transactions (deposits + withdrawals combined)
router.get("/transactions", verifyAdmin, getAllTransactions);

export default router;
