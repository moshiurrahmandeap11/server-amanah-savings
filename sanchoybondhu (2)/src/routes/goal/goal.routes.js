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
router.post("/", createGoal);
router.get("/", getUserGoals);
router.get("/statistics", getGoalStatistics);
router.get("/:id", getGoalById);
router.put("/:id", updateGoal);
router.delete("/:id", deleteGoal);
router.patch("/:id/toggle-status", toggleGoalStatus);

export default router;