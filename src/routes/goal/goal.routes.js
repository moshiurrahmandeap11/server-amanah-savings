// routes/goal.routes.js
import { Router } from "express";
import {
  createGoal,
  getUserGoals,
  getMyGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  toggleGoalStatus,
  getGoalStatistics,
} from "../../controllers/goal/goal.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PUBLIC ROUTES ====================
// Goals are publicly readable and do not require authentication.
router.get("/", getUserGoals);

// ==================== PROTECTED ROUTES ====================
// Goal mutations and private user statistics require authentication.
router.post("/", verifyToken, createGoal);
router.get("/my", verifyToken, getMyGoals);
router.get("/statistics", verifyToken, getGoalStatistics);
router.get("/:id", getGoalById);
router.put("/:id", verifyToken, updateGoal);
router.delete("/:id", verifyToken, deleteGoal);
router.patch("/:id/toggle-status", verifyToken, toggleGoalStatus);

export default router;
