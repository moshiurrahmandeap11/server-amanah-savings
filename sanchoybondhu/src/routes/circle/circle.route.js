// routes/circle.routes.js
import { Router } from "express";
import {
  createCircle,
  getUserCircles,
  getCircleById,
  joinCircle,
  leaveCircle,
  getPublicCircles,
} from "../../controllers/circle/circle.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PROTECTED ROUTES ====================
// All circle routes require authentication
router.use(verifyToken);

// Circle CRUD operations
router.post("/", createCircle);                    // Create new circle
router.get("/", getUserCircles);                   // Get user's circles
router.get("/public", getPublicCircles);            // Get public circles for discovery
router.get("/:id", getCircleById);                 // Get single circle
router.post("/:id/join", joinCircle);              // Join a circle
router.delete("/:id/leave", leaveCircle);          // Leave a circle

export default router;