// routes/leaderboard.routes.js
import { Router } from "express";
import {
  getMonthlyLeaderboard,
  getAllTimeLeaderboard,
  getGoalTypeLeaderboard,
  getUserRankStats,
  getCircleLeaderboard,
} from "../../controllers/leaderboard/leaderboard.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PUBLIC ROUTES ====================
// Some leaderboard data can be public
router.get("/monthly", getMonthlyLeaderboard);
router.get("/all-time", getAllTimeLeaderboard);
router.get("/goal-type/:goalType", getGoalTypeLeaderboard);

// ==================== PROTECTED ROUTES ====================
router.use(verifyToken);
router.get("/my-rank", getUserRankStats);
router.get("/circle/:circleId", getCircleLeaderboard);

export default router;