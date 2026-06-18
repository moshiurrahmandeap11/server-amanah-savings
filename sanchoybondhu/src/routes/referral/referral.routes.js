// routes/referral.routes.js
import { Router } from "express";
import {
  createReferral,
  processReferralBonus,
  getReferralStats,
  getReferralHistory,
  getReferralLeaderboard,
  getReferredUsers,
  getAllReferrals,
} from "../../controllers/referral/referral.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import verifyAdmin from "../../middlewares/verifyAdmin.js";

const router = Router();

// ==================== PUBLIC ROUTES ====================
router.post("/create", createReferral);

// ==================== PROTECTED ROUTES ====================
router.use(verifyToken);

// User routes
router.get("/stats", getReferralStats);
router.get("/history", getReferralHistory);
router.get("/leaderboard", getReferralLeaderboard);
router.get("/referred-users", getReferredUsers);
router.post("/process-bonus", processReferralBonus);

// Admin routes
router.get("/admin/all", verifyAdmin, getAllReferrals);

export default router;