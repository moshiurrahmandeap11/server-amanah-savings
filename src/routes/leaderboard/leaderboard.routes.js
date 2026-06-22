// routes/leaderboard.routes.js
import { Router } from "express";
import {
  getMonthlyLeaderboard,
  getAllTimeLeaderboard,
  getGoalTypeLeaderboard,
  getUserRankStats,
  getCircleLeaderboard,
} from "../../controllers/leaderboard/leaderboard.controller.js";
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
// Some leaderboard data can be public
router.get("/monthly", optionalVerifyToken, getMonthlyLeaderboard);
router.get("/all-time", optionalVerifyToken, getAllTimeLeaderboard);
router.get("/goal-type/:goalType", optionalVerifyToken, getGoalTypeLeaderboard);

// ==================== PROTECTED ROUTES ====================
router.use(verifyToken);
router.get("/my-rank", getUserRankStats);
router.get("/circle/:circleId", getCircleLeaderboard);

export default router;
