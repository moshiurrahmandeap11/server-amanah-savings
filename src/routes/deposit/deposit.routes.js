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
  uploadDepositScreenshot,  // Add this import
} from "../../controllers/deposiit/deposit.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import { uploadSingle } from "../../middlewares/upload.js";  // Add this import

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All deposit routes require authentication
router.use(verifyToken);

// Screenshot upload route (similar to profile picture)
router.post(
  "/screenshot",
  verifyToken,
  uploadSingle("deposit_screenshots", "screenshot"),  // folder: deposit_screenshots, field: screenshot
  uploadDepositScreenshot
);

// User routes
router.post("/", createDeposit);                    // Create deposit request
router.get("/", getUserDeposits);                   // Get user's deposit history
router.get("/statistics", getDepositStatistics);    // Get deposit statistics
router.get("/:id", getDepositById);                 // Get single deposit

// Admin routes (with isAdmin check in controller)
router.get("/admin/all", getAllDeposits);           // Get all deposits (admin only)
router.patch("/:id/approve", approveDeposit);       // Approve deposit
router.patch("/:id/reject", rejectDeposit);         // Reject deposit

export default router;