// controllers/notification/notification.controller.js
import { emitUserNotification } from "../../socket/socket.js";
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Create a notification
export const createNotification = async (req, res) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      icon,
      badge,
      actionType,
      actionData,
      metadata,
    } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const notificationsCollection = db.collection("notifications");

    const notification = {
      userId: new ObjectId(userId),
      type, // deposit, streak, reminder, bonus, achievement, milestone, system
      title,
      message,
      icon: icon || getIconForType(type),
      badge: badge || getBadgeForType(type),
      actionType: actionType || null,
      actionData: actionData || null,
      metadata: metadata || {},
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);

    // Also add to user's notifications array for quick access
    const usersCollection = db.collection("users");
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          notifications: {
            notificationId: result.insertedId,
            read: false,
            createdAt: new Date(),
          },
        },
        $inc: { unreadNotifications: 1 },
      }
    );

    // Emit real-time notification via Socket.IO
    emitUserNotification(userId, { ...notification, _id: result.insertedId });

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: { ...notification, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Create notification error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create notification",
    });
  }
};

// Helper functions
const getIconForType = (type) => {
  const icons = {
    deposit: "💳",
    streak: "🔥",
    reminder: "⏰",
    bonus: "🤝",
    achievement: "🏆",
    milestone: "✅",
    system: "🔔",
    withdrawal: "💸",
    challenge: "🎯",
  };
  return icons[type] || "🔔";
};

const getBadgeForType = (type) => {
  const badges = {
    deposit: "Deposit",
    streak: "Streak",
    reminder: "Reminder",
    bonus: "Bonus",
    achievement: "Achievement",
    milestone: "Milestone",
    system: "System",
    withdrawal: "Withdrawal",
    challenge: "Challenge",
  };
  return badges[type] || "Update";
};

const getColorForType = (type) => {
  const colors = {
    deposit: "bg-primary/15 text-primary",
    streak: "bg-red-500/15 text-red-500",
    reminder: "bg-amber-500/15 text-amber-500",
    bonus: "bg-cyan-500/15 text-cyan-500",
    achievement: "bg-purple-500/15 text-purple-500",
    milestone: "bg-primary/15 text-primary",
    system: "bg-gray-500/15 text-gray-500",
    withdrawal: "bg-red-500/15 text-red-500",
    challenge: "bg-green-500/15 text-green-500",
  };
  return colors[type] || "bg-primary/15 text-primary";
};

// Get user's notifications with aggregation
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, page = 1, limit = 20, unreadOnly = false } = req.query;

    const notificationsCollection = db.collection("notifications");

    const query = { userId: new ObjectId(userId) };
    if (type && type !== "all") {
      query.type = type;
    }
    if (unreadOnly === "true") {
      query.read = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const notifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await notificationsCollection.countDocuments(query);
    const unreadCount = await notificationsCollection.countDocuments({
      userId: new ObjectId(userId),
      read: false,
    });

    // Get counts by type
    const typeCounts = await notificationsCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]).toArray();

    const counts = {
      all: total,
      deposit: typeCounts.find(t => t._id === "deposit")?.count || 0,
      streak: typeCounts.find(t => t._id === "streak")?.count || 0,
      reminder: typeCounts.find(t => t._id === "reminder")?.count || 0,
      bonus: typeCounts.find(t => t._id === "bonus")?.count || 0,
      achievement: typeCounts.find(t => t._id === "achievement")?.count || 0,
      milestone: typeCounts.find(t => t._id === "milestone")?.count || 0,
      withdrawal: typeCounts.find(t => t._id === "withdrawal")?.count || 0,
      challenge: typeCounts.find(t => t._id === "challenge")?.count || 0,
    };

    // Format notifications with colors
    const formattedNotifications = notifications.map(notif => ({
      ...notif,
      color: getColorForType(notif.type),
      timeAgo: getTimeAgo(notif.createdAt),
    }));

    return res.status(200).json({
      success: true,
      data: {
        notifications: formattedNotifications,
        unreadCount,
        counts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get user notifications error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch notifications",
    });
  }
};

// Get time ago helper
const getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) > 1 ? 's' : ''} ago`;
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notificationsCollection = db.collection("notifications");
    const usersCollection = db.collection("users");

    const notification = await notificationsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (notification.read) {
      return res.status(400).json({
        success: false,
        message: "Notification already read",
      });
    }

    await notificationsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Update user's unread count
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $inc: { unreadNotifications: -1 },
        $set: { "notifications.$[elem].read": true },
      },
      {
        arrayFilters: [{ "elem.notificationId": new ObjectId(id) }],
      }
    );

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to mark notification as read",
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    const notificationsCollection = db.collection("notifications");
    const usersCollection = db.collection("users");

    const result = await notificationsCollection.updateMany(
      { userId: new ObjectId(userId), read: false },
      {
        $set: {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Update user's unread count to 0
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: { unreadNotifications: 0 },
        $set: { "notifications.$[].read": true },
      }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: { count: result.modifiedCount },
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to mark all as read",
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notificationsCollection = db.collection("notifications");
    const usersCollection = db.collection("users");

    const notification = await notificationsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notificationsCollection.deleteOne({ _id: new ObjectId(id) });

    // Remove from user's notifications array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $pull: { notifications: { notificationId: new ObjectId(id) } },
        $inc: { unreadNotifications: notification.read ? 0 : -1 },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete notification",
    });
  }
};

// Get notification settings
export const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { notificationSettings: 1 } }
    );

    const defaultSettings = {
      deposit: true,
      streak: true,
      reminder: true,
      bonus: true,
      achievement: true,
      milestone: true,
      withdrawal: true,
      challenge: true,
      email: true,
      push: true,
    };

    const settings = user?.notificationSettings || defaultSettings;

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Get notification settings error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch settings",
    });
  }
};

// Update notification settings
export const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const settings = req.body;

    const usersCollection = db.collection("users");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          notificationSettings: settings,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Notification settings updated",
      data: settings,
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update settings",
    });
  }
};

// Auto-generate notifications from events
export const generateDepositNotification = async (deposit) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    const notification = {
      userId: deposit.userId,
      type: "deposit",
      title: "Deposit Confirmed!",
      message: `Your <strong>৳${deposit.depositAmount.toLocaleString()}</strong> has been verified and deposited to ${deposit.goalName}.`,
      icon: "💳",
      badge: "Deposit",
      metadata: {
        depositId: deposit._id,
        amount: deposit.depositAmount,
        goalName: deposit.goalName,
      },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);
    
    // Update user's unread count
    const usersCollection = db.collection("users");
    await usersCollection.updateOne(
      { _id: deposit.userId },
      {
        $push: {
          notifications: {
            notificationId: result.insertedId,
            read: false,
            createdAt: new Date(),
          },
        },
        $inc: { unreadNotifications: 1 },
      }
    );
    
    // Emit real-time notification
    emitUserNotification(deposit.userId.toString(), { ...notification, _id: result.insertedId });
    
    return result;
  } catch (error) {
    console.error("Generate deposit notification error:", error);
    return null;
  }
};

export const generateStreakNotification = async (userId, streak) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    let title = "";
    let message = "";
    let icon = "🔥";
    let badge = "Streak";

    if (streak === 7) {
      title = "7-Day Warrior!";
      message = "Congratulations! You've maintained a <strong>7 day</strong> savings streak. Keep going!";
    } else if (streak === 30) {
      title = "Monthly Master!";
      message = "Amazing! You've maintained a <strong>30 day</strong> savings streak. You're on fire!";
    } else if (streak === 90) {
      title = "90-Day Streak Achieved!";
      message = "Congratulations! You've maintained a <strong>90 day</strong> savings streak. Only 10 more days for the 100-day badge!";
    } else if (streak === 100) {
      title = "Century Club!";
      message = "Incredible! You've achieved a <strong>100 day</strong> savings streak. You're a true saver!";
    } else if (streak === 180) {
      title = "Half Year Hero!";
      message = "Outstanding! You've maintained a <strong>180 day</strong> savings streak. Half a year of consistency!";
    } else if (streak === 365) {
      title = "Year Long Legend!";
      message = "Legendary! You've maintained a <strong>365 day</strong> savings streak. A full year of saving!";
    } else {
      return null;
    }

    const notification = {
      userId: new ObjectId(userId),
      type: "streak",
      title,
      message,
      icon,
      badge,
      metadata: { streak },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);
    
    // Update user's unread count
    const usersCollection = db.collection("users");
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          notifications: {
            notificationId: result.insertedId,
            read: false,
            createdAt: new Date(),
          },
        },
        $inc: { unreadNotifications: 1 },
      }
    );
    
    // Emit real-time notification
    emitUserNotification(userId, { ...notification, _id: result.insertedId });
    
    return result;
  } catch (error) {
    console.error("Generate streak notification error:", error);
    return null;
  }
};

export const generateBonusNotification = async (userId, amount, type, fromUser) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    let title = "";
    let message = "";
    let icon = "🤝";
    let badge = "Bonus";

    if (type === "referral") {
      title = "Referral Bonus!";
      message = `Your friend <strong>${fromUser}</strong> joined Amanah. <strong>৳${amount.toLocaleString()} bonus</strong> has been credited to your account!`;
    } else if (type === "challenge") {
      title = "Challenge Bonus!";
      message = `Congratulations! You've completed the challenge and earned <strong>৳${amount.toLocaleString()} bonus</strong>!`;
    } else {
      title = "Bonus Credited!";
      message = `<strong>৳${amount.toLocaleString()} bonus</strong> has been credited to your account.`;
    }

    const notification = {
      userId: new ObjectId(userId),
      type: "bonus",
      title,
      message,
      icon,
      badge,
      metadata: { amount, bonusType: type, fromUser },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);
    
    // Update user's unread count
    const usersCollection = db.collection("users");
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          notifications: {
            notificationId: result.insertedId,
            read: false,
            createdAt: new Date(),
          },
        },
        $inc: { unreadNotifications: 1 },
      }
    );
    
    // Emit real-time notification
    emitUserNotification(userId, { ...notification, _id: result.insertedId });
    
    return result;
  } catch (error) {
    console.error("Generate bonus notification error:", error);
    return null;
  }
};

export const generateAchievementNotification = async (userId, badgeName, points) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    const notification = {
      userId: new ObjectId(userId),
      type: "achievement",
      title: "New Achievement Unlocked!",
      message: `You've unlocked the <strong>'${badgeName}'</strong> badge and earned <strong>${points} points</strong>!`,
      icon: "🏆",
      badge: "Achievement",
      metadata: { badgeName, points },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);
    
    // Update user's unread count
    const usersCollection = db.collection("users");
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          notifications: {
            notificationId: result.insertedId,
            read: false,
            createdAt: new Date(),
          },
        },
        $inc: { unreadNotifications: 1 },
      }
    );
    
    // Emit real-time notification
    emitUserNotification(userId, { ...notification, _id: result.insertedId });
    
    return result;
  } catch (error) {
    console.error("Generate achievement notification error:", error);
    return null;
  }
};

export const generateMilestoneNotification = async (userId, goalName, progress, amount) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    const milestones = [25, 50, 75, 100];
    if (!milestones.includes(progress)) return null;

    const notification = {
      userId: new ObjectId(userId),
      type: "milestone",
      title: `${goalName} Goal ${progress}% Complete!`,
      message: `Your ${goalName} fund is ${progress}% complete. ${progress === 100 ? "Congratulations on reaching your target!" : `Only ৳${amount.toLocaleString()} remaining!`}`,
      icon: "✅",
      badge: "Milestone",
      metadata: { goalName, progress, amount },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);
    
    // Update user's unread count
    const usersCollection = db.collection("users");
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          notifications: {
            notificationId: result.insertedId,
            read: false,
            createdAt: new Date(),
          },
        },
        $inc: { unreadNotifications: 1 },
      }
    );
    
    // Emit real-time notification
    emitUserNotification(userId, { ...notification, _id: result.insertedId });
    
    return result;
  } catch (error) {
    console.error("Generate milestone notification error:", error);
    return null;
  }
};

// Admin: Get all notifications
export const getAllNotifications = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;

    const notificationsCollection = db.collection("notifications");

    const query = {};
    if (type && type !== "all") {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const notifications = await notificationsCollection
      .aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            type: 1,
            title: 1,
            message: 1,
            read: 1,
            createdAt: 1,
            "user.fullName": 1,
            "user.email": 1,
            "user.phone": 1,
          },
        },
      ])
      .toArray();

    const total = await notificationsCollection.countDocuments(query);

    const statistics = await notificationsCollection.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          readCount: { $sum: { $cond: ["$read", 1, 0] } },
          unreadCount: { $sum: { $cond: ["$read", 0, 1] } },
        },
      },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        statistics,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get all notifications error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch notifications",
    });
  }
};