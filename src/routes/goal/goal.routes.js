// routes/goal.routes.js
import { Router } from "express";
import {
  createGoal,
  getUserGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  toggleGoalStatus,
  getGoalStatistics,
} from "../../controllers/goal/goal.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All goal routes require authentication
router.use(verifyToken);

// Goal CRUD operations
router.post("/", createGoal);                    // Create new goal
router.get("/", getUserGoals);                   // Get all user goals
router.get("/statistics", getGoalStatistics);    // Get goal statistics
router.get("/:id", getGoalById);                 // Get single goal
router.put("/:id", updateGoal);                  // Update goal
router.delete("/:id", deleteGoal);               // Delete goal
router.patch("/:id/toggle-status", toggleGoalStatus); // Pause/resume goal

export default router;