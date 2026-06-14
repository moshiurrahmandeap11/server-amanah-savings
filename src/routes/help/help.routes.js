// routes/help.routes.js
import { Router } from "express";
import {
  createArticle,
  getAllArticles,
  getArticleById,
  updateArticle,
  deleteArticle,
  submitFeedback,
  getCategories,
  searchArticles,
  getPopularArticles,
  createSupportTicket,
  getUserTickets,
  getTicketById,
  replyToTicket,
  getAllSupportTickets,
  updateTicketStatus,
  getHelpStatistics,
} from "../../controllers/help/help.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";

const router = Router();

// ==================== PUBLIC ROUTES ====================
router.get("/articles", getAllArticles);
router.get("/articles/popular", getPopularArticles);
router.get("/articles/search", searchArticles);
router.get("/articles/:articleId", getArticleById);
router.get("/categories", getCategories);
router.get("/statistics", getHelpStatistics);

// ==================== PROTECTED ROUTES ====================
router.use(verifyToken);

// Feedback
router.post("/articles/:articleId/feedback", submitFeedback);

// Support Tickets
router.post("/tickets", createSupportTicket);
router.get("/tickets", getUserTickets);
router.get("/tickets/:ticketId", getTicketById);
router.post("/tickets/:ticketId/reply", replyToTicket);

// Admin routes
router.post("/admin/articles", createArticle);
router.put("/admin/articles/:articleId", updateArticle);
router.delete("/admin/articles/:articleId", deleteArticle);
router.get("/admin/tickets", getAllSupportTickets);
router.patch("/admin/tickets/:ticketId/status", updateTicketStatus);

export default router;