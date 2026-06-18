// controllers/contact.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Submit contact form
export const submitContactForm = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      topic,
      message,
      userId
    } = req.body;

    // Validation
    if (!name || !message) {
      return res.status(400).json({
        success: false,
        message: "Name and message are required"
      });
    }

    const contactsCollection = db.collection("contact_messages");

    const contactMessage = {
      name,
      phone: phone || null,
      email: email || null,
      topic: topic || "general",
      message,
      userId: userId ? new ObjectId(userId) : null,
      status: "pending",
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      repliedAt: null,
      replyMessage: null,
      repliedBy: null
    };

    const result = await contactsCollection.insertOne(contactMessage);

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: {
        id: result.insertedId,
        ...contactMessage
      }
    });
  } catch (error) {
    console.error("Submit contact form error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send message"
    });
  }
};

// Get all contact messages (Admin only)
export const getAllContactMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, isRead } = req.query;
    
    const contactsCollection = db.collection("contact_messages");
    const usersCollection = db.collection("users");
    
    const query = {};
    if (status && status !== "all") query.status = status;
    if (isRead !== undefined) query.isRead = isRead === "true";
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    const messages = await contactsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();
    
    // Get user info for each message
    const messagesWithUser = await Promise.all(messages.map(async (msg) => {
      let userInfo = null;
      if (msg.userId) {
        const user = await usersCollection.findOne(
          { _id: new ObjectId(msg.userId) },
          { projection: { password: 0, pin: 0 } }
        );
        if (user) {
          userInfo = {
            id: user._id,
            name: user.fullName || user.firstName,
            phone: user.phone,
            email: user.email,
            plan: user.selectedPlan
          };
        }
      }
      return {
        ...msg,
        user: userInfo
      };
    }));
    
    const total = await contactsCollection.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      data: {
        messages: messagesWithUser,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        }
      }
    });
  } catch (error) {
    console.error("Get contact messages error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch messages"
    });
  }
};

// Get single contact message
export const getContactMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const contactsCollection = db.collection("contact_messages");
    const usersCollection = db.collection("users");
    
    const message = await contactsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }
    
    // Mark as read
    if (!message.isRead) {
      await contactsCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            isRead: true,
            readAt: new Date()
          }
        }
      );
    }
    
    let userInfo = null;
    if (message.userId) {
      const user = await usersCollection.findOne(
        { _id: new ObjectId(message.userId) },
        { projection: { password: 0, pin: 0 } }
      );
      if (user) {
        userInfo = {
          id: user._id,
          name: user.fullName || user.firstName,
          phone: user.phone,
          email: user.email
        };
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        ...message,
        user: userInfo
      }
    });
  } catch (error) {
    console.error("Get contact message error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch message"
    });
  }
};

// Reply to contact message (Admin only)
export const replyToContactMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage } = req.body;
    const adminId = req.user.id;
    
    if (!replyMessage) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required"
      });
    }
    
    const contactsCollection = db.collection("contact_messages");
    
    const message = await contactsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }
    
    await contactsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "replied",
          replyMessage: replyMessage,
          repliedAt: new Date(),
          repliedBy: new ObjectId(adminId),
          updatedAt: new Date()
        }
      }
    );
    
    // Here you can also send email notification to user
    // await sendReplyNotificationEmail(message.email, replyMessage);
    
    return res.status(200).json({
      success: true,
      message: "Reply sent successfully"
    });
  } catch (error) {
    console.error("Reply to contact message error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send reply"
    });
  }
};

// Update message status
export const updateMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ["pending", "in_progress", "resolved", "replied"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }
    
    const contactsCollection = db.collection("contact_messages");
    
    const result = await contactsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Status updated successfully"
    });
  } catch (error) {
    console.error("Update message status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update status"
    });
  }
};

// Delete contact message
export const deleteContactMessage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const contactsCollection = db.collection("contact_messages");
    
    const result = await contactsCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Message deleted successfully"
    });
  } catch (error) {
    console.error("Delete contact message error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete message"
    });
  }
};