import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();
const port = process.env.PORT;
const app = express();

// import routes
import users from "./src/routes/auth/auth.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import { connectDB } from "./src/database/db.js";
import goal from "./src/routes/goal/goal.routes.js";
import circle from "./src/routes/circle/circle.route.js";
import deposit from "./src/routes/deposit/deposit.routes.js";

app.use(
  cors({
    origin: ["http://localhost:3000", "https://amanah-savings.vercel.app"],
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

// connect to database
connectDB();

// api endpoints
app.use("/api/users", users);
app.use("/api/upload", uploadRoutes);
app.use("/api/goals", goal);
app.use("/api/circles", circle);
app.use("/api/deposits", deposit);

app.get("/", (req, res) => {
  res.send("amanah savings running rapidly");
});

app.listen(port, () => {
  console.log(`amanah savings running on port http://localhost:${port}`);
});
