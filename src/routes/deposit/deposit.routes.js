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
  getPaymentInstructions,
  uploadDepositScreenshot,
  debugGoalDeposit,
} from "../../controllers/deposiit/deposit.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import verifyAdmin from "../../middlewares/verifyAdmin.js";
import { uploadSingle } from "../../middlewares/upload.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All deposit routes require authentication
router.use(verifyToken);

router.get("/payment-instructions", getPaymentInstructions);

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

// Admin routes - require admin role
router.get("/admin/all", verifyAdmin, getAllDeposits);
router.patch("/:id/approve", verifyAdmin, approveDeposit);
router.patch("/:id/reject", verifyAdmin, rejectDeposit);

export default router;
