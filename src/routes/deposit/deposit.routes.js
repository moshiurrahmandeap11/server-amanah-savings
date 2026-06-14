// routes/deposit.routes.js
import { Router } from "express";
import {
  createDeposit,
  getUserDeposits,
  getDepositById,
  getAllDeposits,
  approveDeposit,
  rejectDeposit,
  getDepositStatistics,
  uploadDepositScreenshot,
  debugGoalDeposit,
} from "../../controllers/deposiit/deposit.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import { uploadSingle } from "../../middlewares/upload.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All deposit routes require authentication
router.use(verifyToken);

// Screenshot upload route
router.post(
  "/screenshot",
  uploadSingle("deposit_screenshots", "screenshot"),
  uploadDepositScreenshot
);

// User routes
router.post("/", createDeposit);
router.get("/", getUserDeposits);
router.get("/statistics", getDepositStatistics);
router.get("/:id", getDepositById);

// Debug route (remove in production)
router.get("/debug/goal/:goalId", debugGoalDeposit);

// Admin routes
router.get("/admin/all", getAllDeposits);
router.patch("/:id/approve", approveDeposit);
router.patch("/:id/reject", rejectDeposit);

export default router;