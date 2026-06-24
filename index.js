import planUpgradeRoutes from "./src/routes/plan/plan.routes.js";import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { initSocketIO } from "./src/socket/socket.js";

dotenv.config();
const port = process.env.PORT;
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
initSocketIO(httpServer);

// import routes
import users from "./src/routes/auth/auth.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import { connectDB } from "./src/database/db.js";
import goal from "./src/routes/goal/goal.routes.js";
import circle from "./src/routes/circle/circle.route.js";
import deposit from "./src/routes/deposit/deposit.routes.js";
import withdrawal from "./src/routes/withdrawal/withdrawal.routes.js";
import transferRoutes from "./src/routes/transfer/transfer.routes.js";
import autoSaveRoutes from "./src/routes/auto-save/autoSave.routes.js";
import zakatRoutes from "./src/routes/zakat/zakat.routes.js";
import leaderboardRoutes from "./src/routes/leaderboard/leaderboard.routes.js";
import challengeRoutes from "./src/routes/challenge/challenge.routes.js";
import achievementRoutes from "./src/routes/achievement/achievement.routes.js";
import referralRoutes from "./src/routes/referral/referral.routes.js";
import notificationRoutes from "./src/routes/notification/notification.routes.js";
import helpRoutes from "./src/routes/help/help.routes.js";
import contactRoutes from "./src/routes/contact/contact.routes.js";
import adminRoutes from "./src/routes/admin/admin.routes.js";
import balanceRoutes from "./src/routes/balance/balance.routes.js";
import { getCmsContent, getPaymentInstructions } from "./src/controllers/admin/admin.controller.js";

app.use(
  cors({
    origin: ["http://localhost:3000", "https://sanchoybondhu.com", "https://amanah-savings.vercel.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    exposedHeaders: ["Authorization"],
  }),
);

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// connect to database FIRST before loading routes
await connectDB();

// api endpoints
app.use("/api/users", users);
app.use("/api/upload", uploadRoutes);
app.use("/api/goals", goal);
app.use("/api/circles", circle);
app.use("/api/deposits", deposit);
app.use("/api/withdrawals", withdrawal);
app.use("/api/transfers", transferRoutes);
app.use("/api/auto-save", autoSaveRoutes);
app.use("/api/zakat", zakatRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/help", helpRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/balance", balanceRoutes);
app.use("/api/plan-upgrades", planUpgradeRoutes);
app.get("/api/cms", getCmsContent);
app.get("/api/payment-instructions", getPaymentInstructions);

app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("Sanchoy Server is running...")
})

httpServer.listen(port, () => {
  console.log(`amanah savings running on port http://localhost:${port}`);
});
