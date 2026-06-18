// routes/withdrawal.routes.js
import { Router } from "express";
import {
  createWithdrawal,
  getUserWithdrawals,
  getWithdrawalById,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  completeWithdrawal,
  getWithdrawalStatistics,
} from "../../controllers/withdrawal/withdrawal.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import verifyAdmin from "../../middlewares/verifyAdmin.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All withdrawal routes require authentication
router.use(verifyToken);

// User routes
router.post("/", createWithdrawal);
router.get("/", getUserWithdrawals);
router.get("/statistics", getWithdrawalStatistics);
router.get("/:id", getWithdrawalById);

// Admin routes - require admin role
router.get("/admin/all", verifyAdmin, getAllWithdrawals);
router.patch("/:id/approve", verifyAdmin, approveWithdrawal);
router.patch("/:id/reject", verifyAdmin, rejectWithdrawal);
router.patch("/:id/complete", verifyAdmin, completeWithdrawal);

export default router;