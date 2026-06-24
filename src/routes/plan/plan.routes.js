import { Router } from "express";
import verifyToken from "../../middlewares/verifyToken.js";
import {
  createPlanUpgradeRequest,
  getMyPlanUpgrades,
} from "../../controllers/plan/plan.controller.js";

const router = Router();

// User routes (protected)
router.use(verifyToken);

// Create a new plan upgrade request
router.post("/", createPlanUpgradeRequest);

// Get my plan upgrade requests
router.get("/my", getMyPlanUpgrades);

export default router;
