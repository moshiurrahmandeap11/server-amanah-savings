// routes/transfer.routes.js
import { Router } from "express";
import {
  goalToGoalTransfer,
  userToUserTransfer,
  searchUserByPhone,
  getUserTransfers,
  getTransferById,
  getAllTransfers,
  getRecipientGoals,
} from "../../controllers/transfer/transfer.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import verifyAdmin from "../../middlewares/verifyAdmin.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All transfer routes require authentication
router.use(verifyToken);

// Transfer actions
router.post("/goal-to-goal", goalToGoalTransfer);
router.post("/user-to-user", userToUserTransfer);
router.get("/search-user", searchUserByPhone);
router.get("/recipient-goals/:userId", getRecipientGoals);

// Admin routes
router.get("/admin/all", verifyAdmin, getAllTransfers);

// User routes
router.get("/", getUserTransfers);
router.get("/:id", getTransferById);

export default router;
