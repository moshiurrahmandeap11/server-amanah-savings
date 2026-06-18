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
import verifyAdmin from "../../middlewares/verifyAdmin.js";

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

// Admin routes - require admin role
router.post("/admin/create", verifyAdmin, createChallenge);
router.put("/admin/:id", verifyAdmin, updateChallengeStatus);
router.patch("/admin/:id/status", verifyAdmin, updateChallengeStatus);
router.get("/admin/statistics", verifyAdmin, getChallengeStatistics);

export default router;