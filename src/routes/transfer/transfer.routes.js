// routes/transfer.routes.js
import { Router } from "express";
import {
  goalToGoalTransfer,
  userToUserTransfer,
  searchUserByPhone,
  getUserTransfers,
  getTransferById,
  getAllTransfers,
} from "../../controllers/transfer/transfer.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All transfer routes require authentication
router.use(verifyToken);

// Transfer actions
router.post("/goal-to-goal", goalToGoalTransfer);
router.post("/user-to-user", userToUserTransfer);
router.get("/search-user", searchUserByPhone);

// User routes
router.get("/", getUserTransfers);
router.get("/:id", getTransferById);

// Admin routes
router.get("/admin/all", getAllTransfers);

export default router;