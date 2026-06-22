// routes/auto-save.routes.js
import { Router } from "express";
import {
  createAutoSaveRule,
  getUserAutoSaveRules,
  getAutoSaveRuleById,
  updateAutoSaveRule,
  pauseAutoSaveRule,
  resumeAutoSaveRule,
  deleteAutoSaveRule,
  getAllAutoSaveRules,
  getAutoSaveStatistics,
} from "../../controllers/auto-save/autoSave.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import verifyAdmin from "../../middlewares/verifyAdmin.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All auto-save routes require authentication
router.use(verifyToken);

// User routes
router.post("/", createAutoSaveRule);
router.get("/", getUserAutoSaveRules);
router.get("/statistics", getAutoSaveStatistics);
router.get("/admin/all", verifyAdmin, getAllAutoSaveRules);
router.get("/:id", getAutoSaveRuleById);
router.put("/:id", updateAutoSaveRule);
router.patch("/:id/pause", pauseAutoSaveRule);
router.patch("/:id/resume", resumeAutoSaveRule);
router.delete("/:id", deleteAutoSaveRule);

export default router;
