// routes/circle.routes.js
import { Router } from "express";
import {
  createCircle,
  getUserCircles,
  getCircleById,
  joinCircle,
  leaveCircle,
  getPublicCircles,
  generateInviteLink,
  joinCircleByInvite,
  deleteCircle,
  updateCircle,
} from "../../controllers/circle/circle.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import jwt from "jsonwebtoken";

const router = Router();

const optionalVerifyToken = (req, _res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) return next();

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.user = {
        _id: decoded._id || decoded.id || decoded.userId,
        ...decoded,
      };
    }
    next();
  });
};

// ==================== PUBLIC ROUTES ====================
router.get("/public", optionalVerifyToken, getPublicCircles); // Get public circles for discovery
router.get("/:id", optionalVerifyToken, getCircleById);       // Public circle details; private requires membership

// ==================== PROTECTED ROUTES ====================
// Circle CRUD operations
router.post("/", verifyToken, createCircle);                    // Create new circle
router.get("/", verifyToken, getUserCircles);                   // Get user's circles
router.post("/:id/join", verifyToken, joinCircle);              // Join a public circle
router.delete("/:id/leave", verifyToken, leaveCircle);    

router.post("/:id/invite", verifyToken, generateInviteLink);        // Generate invite link
router.post("/join/:inviteCode", verifyToken, joinCircleByInvite); // Join private circle by invite

router.patch("/:id", verifyToken, updateCircle);                    // Update circle (admin only)
router.delete("/:id", verifyToken, deleteCircle);                   

export default router;
