// routes/balance.routes.js
import { Router } from "express";
import {
  getUserBalanceSummary,
  createReferralBonusWithdrawal,
} from "../../controllers/balance/balance.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// All balance routes require authentication
router.use(verifyToken);

// Get user's balance summary
router.get("/summary", getUserBalanceSummary);

// Create referral bonus withdrawal request
router.post("/referral-withdrawal", createReferralBonusWithdrawal);

export default router;
