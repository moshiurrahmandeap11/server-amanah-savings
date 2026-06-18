// routes/contact.routes.js
import { Router } from "express";
import {
  submitContactForm,
  getAllContactMessages,
  getContactMessageById,
  replyToContactMessage,
  updateMessageStatus,
  deleteContactMessage
} from "../../controllers/contact/contact.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import verifyAdmin from "../../middlewares/verifyAdmin.js";

const router = Router();

// Public route - anyone can submit
router.post("/submit", submitContactForm);

// Protected routes - Admin only
router.get("/admin/messages", verifyToken, verifyAdmin, getAllContactMessages);
router.get("/admin/messages/:id", verifyToken, verifyAdmin, getContactMessageById);
router.post("/admin/messages/:id/reply", verifyToken, verifyAdmin, replyToContactMessage);
router.patch("/admin/messages/:id/status", verifyToken, verifyAdmin, updateMessageStatus);
router.delete("/admin/messages/:id", verifyToken, verifyAdmin, deleteContactMessage);

export default router;