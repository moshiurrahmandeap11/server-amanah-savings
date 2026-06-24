// routes/balance.routes.js
import { Router } from "express";
import {
  getUserBalanceSummary,
  createReferralBonusWithdrawal,
  transferReferralBonusToGoal,
} from "../../controllers/balance/balance.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// All balance routes require authentication
router.use(verifyToken);

// Get user's balance summary
router.get("/summary", getUserBalanceSummary);

// Create referral bonus withdrawal request
router.post("/referral-withdrawal", createReferralBonusWithdrawal);

// Transfer referral bonus to a goal
router.post("/referral-to-goal", transferReferralBonusToGoal);

export default router;
