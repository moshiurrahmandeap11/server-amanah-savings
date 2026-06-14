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

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All withdrawal routes require authentication
router.use(verifyToken);

// User routes
router.post("/", createWithdrawal);
router.get("/", getUserWithdrawals);
router.get("/statistics", getWithdrawalStatistics);
router.get("/:id", getWithdrawalById);

// Admin routes
router.get("/admin/all", getAllWithdrawals);
router.patch("/:id/approve", approveWithdrawal);
router.patch("/:id/reject", rejectWithdrawal);
router.patch("/:id/complete", completeWithdrawal);

export default router;