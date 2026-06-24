// socket/socket.js (server side)
import { Server } from "socket.io";
import { db } from "../database/db.js";
import { ObjectId } from "mongodb";

let io = null;

const toObjectIdSafe = (value) => {
  try {
    if (!value) return null;
    if (ObjectId.isValid(value)) {
      return new ObjectId(value);
    }
    return null;
  } catch (_error) {
    return null;
  }
};

export const initSocketIO = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "https://sanchoybondhu.com", "https://amanah-savings.vercel.app"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Join user-specific room for targeted notifications
    socket.on("join", (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined room user_${userId}`);
      }
    });

    // Join admin room for admin notifications
    socket.on("join_admin_room", (data) => {
      const { adminId } = data || {};
      socket.join("admin");
      if (adminId) {
        socket.join(`admin_${adminId}`);
      }
      console.log(`Socket ${socket.id} joined admin room, adminId: ${adminId}`);
    });

    // Join ticket room for ticket-specific chat
    socket.on("join_ticket_room", (data) => {
      const { ticketId, userId } = data || {};
      if (ticketId) {
        socket.join(`ticket_${ticketId}`);
        console.log(`Socket ${socket.id} joined ticket room: ${ticketId}`);
      }
    });

    // Leave ticket room
    socket.on("leave_ticket_room", (data) => {
      const { ticketId } = data || {};
      if (ticketId) {
        socket.leave(`ticket_${ticketId}`);
        console.log(`Socket ${socket.id} left ticket room: ${ticketId}`);
      }
    });

    // Handle messaging
    socket.on("send_message", async (data) => {
      try {
        const { senderId, receiverId, message, senderRole = "user", ticketId } = data;
        if (!senderId || !receiverId || !message) return;

        const messagesCollection = db.collection("messages");
        const senderObjectId = toObjectIdSafe(senderId);
        const receiverObjectId = toObjectIdSafe(receiverId);

        if (!senderObjectId) {
          return;
        }

        const newMessage = {
          senderId: senderObjectId,
          receiverId: receiverObjectId,
          message,
          senderRole,
          ticketId: ticketId || null,
          read: false,
          createdAt: new Date(),
        };
        const result = await messagesCollection.insertOne(newMessage);
        const msgWithId = { ...newMessage, _id: result.insertedId };

        if (receiverId === "admin") {
          socket.to("admin").emit("receive_message", msgWithId);
        } else {
          io.to(`user_${receiverId}`).emit("receive_message", msgWithId);
          if (senderRole === "admin") {
            socket.to("admin").emit("receive_message", msgWithId);
          }
        }

        // Acknowledge sender exactly once to avoid duplicate local renders
        socket.emit("receive_message", msgWithId);

        // Ticket-room broadcast excludes sender socket
        if (ticketId) {
          socket.to(`ticket_${ticketId}`).emit("receive_message", msgWithId);
        }
        
        console.log("Message sent:", msgWithId);
      } catch (err) {
        console.error("Socket send_message error:", err);
      }
    });

    // Mark message as read
    socket.on("mark_read", async (data) => {
      try {
        const { messageId, userId } = data;
        const messagesCollection = db.collection("messages");
        await messagesCollection.updateOne(
          { _id: new ObjectId(messageId) },
          { $set: { read: true, updatedAt: new Date() } }
        );
        io.to(`user_${userId}`).emit("message_read", { messageId });
      } catch (err) {
        console.error("Socket mark_read error:", err);
      }
    });

    // Typing indicator
    socket.on("typing", (data) => {
      const { receiverId, userId, userType } = data;
      if (receiverId) {
        io.to(`user_${receiverId}`).emit("typing", { userId, userType });
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

// Emit notification to a specific user
export const emitUserNotification = (userId, notification) => {
  if (!io) return;
  io.to(`user_${userId}`).emit("notification", notification);
};

// Emit notification to all admins
export const emitAdminNotification = (notification) => {
  if (!io) return;
  io.to("admin").emit("admin_notification", notification);
};

// Emit new ticket to admins
export const emitNewTicket = (ticket) => {
  if (!io) return;
  io.to("admin").emit("new_ticket", ticket);
};

// Emit ticket reply to involved users
export const emitTicketReply = (userId, ticketId, reply) => {
  if (!io) return;
  io.to(`user_${userId}`).emit("ticket_reply", { ticketId, reply });
};