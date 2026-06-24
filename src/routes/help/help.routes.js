// routes/help.routes.js
import { Router } from "express";
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";
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
import verifyAdmin from "../../middlewares/verifyAdmin.js";

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

// User: Get my chat messages (both sent and received)
router.get("/messages", async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { limit = 50 } = req.query;
    const messagesCollection = db.collection("messages");
    
    const messages = await messagesCollection
      .find({
        $or: [
          { senderId: new ObjectId(userId) },
          { receiverId: new ObjectId(userId) },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    return res.status(200).json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    console.error("Get user messages error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch messages",
    });
  }
});

// Admin routes
router.post("/admin/articles", verifyAdmin, createArticle);
router.put("/admin/articles/:articleId", verifyAdmin, updateArticle);
router.delete("/admin/articles/:articleId", verifyAdmin, deleteArticle);
router.get("/admin/tickets", verifyAdmin, getAllSupportTickets);
router.patch("/admin/tickets/:ticketId/status", verifyAdmin, updateTicketStatus);

// Admin: Get messages for a specific user (for admin support chat)
router.get("/admin/messages/:userId", verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, chatType = "all" } = req.query;
    const adminId = req.user._id || req.user.id;
    const messagesCollection = db.collection("messages");
    const match = {
      $or: [
        { senderId: new ObjectId(userId), receiverId: new ObjectId(adminId) },
        { senderId: new ObjectId(adminId), receiverId: new ObjectId(userId) },
      ],
    };

    if (chatType === "live") {
      match.$or = [
        { ...match.$or[0], $or: [{ ticketId: null }, { ticketId: { $exists: false } }] },
        { ...match.$or[1], $or: [{ ticketId: null }, { ticketId: { $exists: false } }] },
      ];
    }
    
    const messages = await messagesCollection
      .find(match)
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .toArray();
    
    return res.status(200).json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    console.error("Get admin messages error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch messages",
    });
  }
});

// Admin: Send a direct message to a user (REST API fallback)
router.post("/admin/messages/:userId", verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { message, ticketId } = req.body;
    const { chatType = "all" } = req.query;
    const adminId = req.user._id || req.user.id;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }
    
    const messagesCollection = db.collection("messages");
    const newMessage = {
      senderId: new ObjectId(adminId),
      receiverId: new ObjectId(userId),
      message,
      senderRole: "admin",
      ticketId: chatType === "live" ? null : (ticketId || null),
      read: false,
      createdAt: new Date(),
    };
    
    const result = await messagesCollection.insertOne(newMessage);
    const msgWithId = { ...newMessage, _id: result.insertedId };
    
    // Emit via socket if available
    try {
      const { getIO } = await import("../../socket/socket.js");
      const io = getIO();
      io.to(`user_${userId}`).emit("receive_message", msgWithId);
      io.to(`user_${adminId}`).emit("receive_message", msgWithId);
      io.to("admin").emit("receive_message", msgWithId);
    } catch (socketErr) {
      console.warn("Socket emit failed, message saved to DB:", socketErr.message);
    }
    
    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: msgWithId,
    });
  } catch (error) {
    console.error("Admin send message error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send message",
    });
  }
});

export default router;