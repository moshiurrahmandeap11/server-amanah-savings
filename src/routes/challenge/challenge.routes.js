// routes/challenge.routes.js
import { Router } from "express";
import {
  createChallenge,
  getAllChallenges,
  getChallengeById,
  joinChallenge,
  updateChallengeProgress,
  getUserChallenges,
  getChallengeLeaderboard,
  updateChallengeStatus,
  getChallengeStatistics,
} from "../../controllers/challenge/challenge.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PUBLIC ROUTES ====================
router.get("/", getAllChallenges);
router.get("/:id", getChallengeById);
router.get("/:id/leaderboard", getChallengeLeaderboard);

// ==================== PROTECTED ROUTES ====================
router.use(verifyToken);

// User routes
router.post("/:id/join", joinChallenge);
router.post("/:id/progress", updateChallengeProgress);
router.get("/user/my-challenges", getUserChallenges);

// Admin routes
router.post("/admin/create", createChallenge);
router.patch("/admin/:id/status", updateChallengeStatus);
router.get("/admin/statistics", getChallengeStatistics);

export default router;