// routes/achievement.routes.js
import { Router } from "express";
import {
  getUserAchievements,
  getBadgeDetails,
  getPointsLeaderboard,
  getUserLevelInfo,
  getUserAchievementsAdmin,
} from "../../controllers/achievement/achievement.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
router.use(verifyToken);

// User routes
router.get("/", getUserAchievements);
router.get("/level", getUserLevelInfo);
router.get("/leaderboard", getPointsLeaderboard);
router.get("/badge/:badgeId", getBadgeDetails);

// Admin routes
router.get("/admin/user/:userId", getUserAchievementsAdmin);

export default router;