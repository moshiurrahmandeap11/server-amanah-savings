// routes/zakat.routes.js
import { Router } from "express";
import {
  calculateZakat,
  createZakatGoal,
  getZakatHistory,
  getCurrentZakat,
  getZakatStatistics,
  saveZakatCalculation,
  getAllZakatCalculations,
} from "../../controllers/zakat/zakat.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All zakat routes require authentication
router.use(verifyToken);

// User routes
router.post("/calculate", calculateZakat);
router.post("/save", saveZakatCalculation);
router.post("/create-goal", createZakatGoal);
router.get("/history", getZakatHistory);
router.get("/current", getCurrentZakat);
router.get("/statistics", getZakatStatistics);

// Admin routes
router.get("/admin/all", getAllZakatCalculations);

export default router;