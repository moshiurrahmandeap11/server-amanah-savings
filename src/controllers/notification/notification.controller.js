// controllers/notification/notification.controller.js
import { emitUserNotification } from "../../socket/socket.js";
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Helper functions
const getIconForType = (type) => {
  const icons = {
    deposit: "💳",
    withdrawal: "💸",
    transfer: "🔄",
    streak: "🔥",
    reminder: "⏰",
    bonus: "🤝",
    achievement: "🏆",
    milestone: "✅",
    system: "🔔",
    challenge: "🎯",
    goal: "🎯",
    zakat: "☪️",
  };
  return icons[type] || "🔔";
};

const getBadgeForType = (type) => {
  const badges = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    transfer: "Transfer",
    streak: "Streak",
    reminder: "Reminder",
    bonus: "Bonus",
    achievement: "Achievement",
    milestone: "Milestone",
    system: "System",
    challenge: "Challenge",
    goal: "Goal",
    zakat: "Zakat",
  };
  return badges[type] || "Update";
};

const getColorForType = (type) => {
  const colors = {
    deposit: "bg-primary/15 text-primary",
    withdrawal: "bg-red-500/15 text-red-500",
    transfer: "bg-purple-500/15 text-purple-500",
    streak: "bg-red-500/15 text-red-500",
    reminder: "bg-amber-500/15 text-amber-500",
    bonus: "bg-cyan-500/15 text-cyan-500",
    achievement: "bg-purple-500/15 text-purple-500",
    milestone: "bg-primary/15 text-primary",
    system: "bg-gray-500/15 text-gray-500",
    challenge: "bg-green-500/15 text-green-500",
    goal: "bg-emerald-500/15 text-emerald-500",
    zakat: "bg-emerald-500/15 text-emerald-500",
  };
  return colors[type] || "bg-primary/15 text-primary";
};

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

// ==================== NOTIFICATION GENERATORS ====================

// Generate Deposit Notification
export const generateDepositNotification = async (deposit, status = 'approved') => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    let title = "";
    let message = "";
    let icon = "💳";
    let badge = "Deposit";

    if (status === 'pending') {
      title = "Deposit Pending Approval";
      message = `Your deposit of <strong>৳${deposit.depositAmount.toLocaleString()}</strong> to <strong>${deposit.goalName}</strong> is pending approval.`;
      icon = "⏳";
      badge = "Pending";
    } else if (status === 'approved') {
      title = "Deposit Confirmed! ✅";
      message = `Your deposit of <strong>৳${deposit.depositAmount.toLocaleString()}</strong> has been verified and added to <strong>${deposit.goalName}</strong>.`;
      icon = "💳";
      badge = "Approved";
    } else if (status === 'rejected') {
      title = "Deposit Rejected ❌";
      message = `Your deposit of <strong>৳${deposit.depositAmount.toLocaleString()}</strong> to <strong>${deposit.goalName}</strong> was rejected. Please contact support.`;
      icon = "❌";
      badge = "Rejected";
    } else {
      return null;
    }

    const notification = {
      userId: deposit.userId,
      type: "deposit",
      title,
      message,
      icon,
      badge,
      actionType: "deposit",
      actionData: { depositId: deposit._id, goalId: deposit.goalId },
      metadata: {
        depositId: deposit._id,
        amount: deposit.depositAmount,
        goalName: deposit.goalName,
        status,
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

// Generate Withdrawal Notification
export const generateWithdrawalNotification = async (withdrawal, status = 'approved') => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    let title = "";
    let message = "";
    let icon = "💸";
    let badge = "Withdrawal";

    if (status === 'pending') {
      title = "Withdrawal Pending Approval";
      message = `Your withdrawal of <strong>৳${withdrawal.withdrawalAmount.toLocaleString()}</strong> from <strong>${withdrawal.goalName}</strong> is pending approval.`;
      icon = "⏳";
      badge = "Pending";
    } else if (status === 'approved' || status === 'completed') {
      title = "Withdrawal Approved! ✅";
      message = `Your withdrawal of <strong>৳${withdrawal.withdrawalAmount.toLocaleString()}</strong> from <strong>${withdrawal.goalName}</strong> has been approved and processed.`;
      icon = "💸";
      badge = "Approved";
    } else if (status === 'rejected') {
      title = "Withdrawal Rejected ❌";
      message = `Your withdrawal of <strong>৳${withdrawal.withdrawalAmount.toLocaleString()}</strong> from <strong>${withdrawal.goalName}</strong> was rejected. <strong>Reason:</strong> ${withdrawal.remarks || "No reason provided"}`;
      icon = "❌";
      badge = "Rejected";
    } else {
      return null;
    }

    const notification = {
      userId: withdrawal.userId,
      type: "withdrawal",
      title,
      message,
      icon,
      badge,
      actionType: "withdrawal",
      actionData: { withdrawalId: withdrawal._id, goalId: withdrawal.goalId },
      metadata: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.withdrawalAmount,
        goalName: withdrawal.goalName,
        status,
        remarks: withdrawal.remarks || null,
      },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);
    
    // Update user's unread count
    const usersCollection = db.collection("users");
    await usersCollection.updateOne(
      { _id: withdrawal.userId },
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
    emitUserNotification(withdrawal.userId.toString(), { ...notification, _id: result.insertedId });
    
    return result;
  } catch (error) {
    console.error("Generate withdrawal notification error:", error);
    return null;
  }
};

// Generate Transfer Notification
export const generateTransferNotification = async (userId, transfer, fromGoalName, toGoalName, transferType, recipientId = null) => {
  try {
    const notificationsCollection = db.collection("notifications");
    const usersCollection = db.collection("users");
    
    let notifications = [];

    if (transferType === 'goal_to_goal') {
      // Notification for goal-to-goal transfer
      const notification = {
        userId: new ObjectId(userId),
        type: "transfer",
        title: "Transfer Complete 🔄",
        message: `<strong>৳${transfer.amount.toLocaleString()}</strong> transferred from <strong>${fromGoalName}</strong> to <strong>${toGoalName}</strong> successfully.`,
        icon: "🔄",
        badge: "Transfer",
        actionType: "transfer",
        actionData: { transferId: transfer._id },
        metadata: {
          transferId: transfer._id,
          amount: transfer.amount,
          fromGoal: fromGoalName,
          toGoal: toGoalName,
          type: 'goal_to_goal',
        },
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      notifications.push(notification);
    } else if (transferType === 'user_to_user') {
      // Notification for sender (money sent)
      const senderNotification = {
        userId: new ObjectId(userId),
        type: "transfer",
        title: "Money Sent 💸",
        message: `<strong>৳${transfer.amount.toLocaleString()}</strong> sent to <strong>${transfer.toUserName}</strong> from <strong>${fromGoalName}</strong> successfully.`,
        icon: "💸",
        badge: "Sent",
        actionType: "transfer",
        actionData: { transferId: transfer._id },
        metadata: {
          transferId: transfer._id,
          amount: transfer.amount,
          fromGoal: fromGoalName,
          toUser: transfer.toUserName,
          type: 'user_to_user_sent',
        },
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      notifications.push(senderNotification);

      // Notification for recipient (money received)
      if (recipientId) {
        const recipientNotification = {
          userId: new ObjectId(recipientId),
          type: "transfer",
          title: "Money Received 💰",
          message: `<strong>৳${transfer.amount.toLocaleString()}</strong> received from <strong>${transfer.fromUserName}</strong> to <strong>${toGoalName}</strong>.`,
          icon: "💰",
          badge: "Received",
          actionType: "transfer",
          actionData: { transferId: transfer._id },
          metadata: {
            transferId: transfer._id,
            amount: transfer.amount,
            fromUser: transfer.fromUserName,
            toGoal: toGoalName,
            type: 'user_to_user_received',
          },
          read: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        notifications.push(recipientNotification);
      }
    }

    // Insert all notifications
    const results = [];
    for (const notification of notifications) {
      const result = await notificationsCollection.insertOne(notification);
      results.push(result);
      
      // Update user's unread count
      await usersCollection.updateOne(
        { _id: notification.userId },
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
      emitUserNotification(notification.userId.toString(), { ...notification, _id: result.insertedId });
    }
    
    return results;
  } catch (error) {
    console.error("Generate transfer notification error:", error);
    return null;
  }
};

// Generate Streak Notification
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
    } else if (streak === 14) {
      title = "2 Weeks Strong!";
      message = "Amazing! You've maintained a <strong>14 day</strong> savings streak. You're building great habits!";
    } else if (streak === 21) {
      title = "21-Day Habit Formed!";
      message = "Outstanding! You've maintained a <strong>21 day</strong> savings streak. This is now a habit!";
    } else if (streak === 30) {
      title = "Monthly Master!";
      message = "Incredible! You've maintained a <strong>30 day</strong> savings streak. You're on fire!";
    } else if (streak === 60) {
      title = "2 Months of Consistency!";
      message = "Amazing! You've maintained a <strong>60 day</strong> savings streak. Keep the momentum going!";
    } else if (streak === 90) {
      title = "90-Day Streak Achieved!";
      message = "Congratulations! You've maintained a <strong>90 day</strong> savings streak. Only 10 more days for the 100-day badge!";
    } else if (streak === 100) {
      title = "Century Club! 🎉";
      message = "Incredible! You've achieved a <strong>100 day</strong> savings streak. You're a true saver!";
    } else if (streak === 180) {
      title = "Half Year Hero!";
      message = "Outstanding! You've maintained a <strong>180 day</strong> savings streak. Half a year of consistency!";
    } else if (streak === 365) {
      title = "Year Long Legend! 🏆";
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
      actionType: "streak",
      actionData: { streak },
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

// Generate Bonus Notification
export const generateBonusNotification = async (userId, amount, type, fromUser = null) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    let title = "";
    let message = "";
    let icon = "🤝";
    let badge = "Bonus";

    if (type === "referral") {
      title = "Referral Bonus! 🎉";
      message = `Your friend <strong>${fromUser}</strong> joined Sanchoy Bondhu. <strong>৳${amount.toLocaleString()} bonus</strong> has been credited to your account!`;
    } else if (type === "challenge") {
      title = "Challenge Bonus! 🏆";
      message = `Congratulations! You've completed the challenge and earned <strong>৳${amount.toLocaleString()} bonus</strong>!`;
    } else if (type === "milestone") {
      title = "Milestone Bonus! ✅";
      message = `You've reached a savings milestone! <strong>৳${amount.toLocaleString()} bonus</strong> has been credited!`;
    } else if (type === "daily") {
      title = "Daily Bonus! 🌟";
      message = `You've saved today! <strong>৳${amount.toLocaleString()} bonus</strong> has been added to your account.`;
    } else {
      title = "Bonus Credited! 💰";
      message = `<strong>৳${amount.toLocaleString()} bonus</strong> has been credited to your account.`;
    }

    const notification = {
      userId: new ObjectId(userId),
      type: "bonus",
      title,
      message,
      icon,
      badge,
      actionType: "bonus",
      actionData: { amount, bonusType: type },
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

// Generate Achievement Notification
export const generateAchievementNotification = async (userId, badgeName, points) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    const notification = {
      userId: new ObjectId(userId),
      type: "achievement",
      title: "New Achievement Unlocked! 🏆",
      message: `You've unlocked the <strong>'${badgeName}'</strong> badge and earned <strong>${points} points</strong>!`,
      icon: "🏆",
      badge: "Achievement",
      actionType: "achievement",
      actionData: { badgeName, points },
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

// Generate Milestone Notification
export const generateMilestoneNotification = async (userId, goalName, progress, remainingAmount) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    const milestones = [10, 25, 50, 75, 90, 100];
    if (!milestones.includes(progress)) return null;

    let title = "";
    let message = "";
    let icon = "✅";
    let badge = "Milestone";

    if (progress === 10) {
      title = "First Steps! 🌱";
      message = `You're <strong>10%</strong> of the way to your ${goalName} goal. Every step counts!`;
    } else if (progress === 25) {
      title = "Quarter Way There! 📈";
      message = `Your ${goalName} fund is <strong>25%</strong> complete. Keep the momentum going!`;
    } else if (progress === 50) {
      title = "Halfway There! 🎯";
      message = `Your ${goalName} fund is <strong>50%</strong> complete. Only ৳${remainingAmount.toLocaleString()} remaining!`;
    } else if (progress === 75) {
      title = "Almost There! 🏃";
      message = `Your ${goalName} fund is <strong>75%</strong> complete. Just ৳${remainingAmount.toLocaleString()} to go!`;
    } else if (progress === 90) {
      title = "So Close! 💪";
      message = `Your ${goalName} fund is <strong>90%</strong> complete. Only ৳${remainingAmount.toLocaleString()} remaining!`;
    } else if (progress === 100) {
      title = "Goal Achieved! 🎉";
      message = `Congratulations! You've reached your <strong>${goalName}</strong> goal of ৳${remainingAmount.toLocaleString()}!`;
    }

    const notification = {
      userId: new ObjectId(userId),
      type: "milestone",
      title,
      message,
      icon,
      badge,
      actionType: "milestone",
      actionData: { goalName, progress },
      metadata: { goalName, progress, remainingAmount },
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

// Generate Goal Created Notification
export const generateGoalCreatedNotification = async (userId, goalName, goalType) => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    const emojis = {
      wedding: "💒",
      education: "📚",
      travel: "✈️",
      hajj: "🕌",
      home: "🏠",
      business: "💼",
      emergency: "🚨",
      zakat: "☪️",
      other: "🎯",
    };

    const notification = {
      userId: new ObjectId(userId),
      type: "goal",
      title: "New Goal Created! 🎯",
      message: `You've created a new goal: <strong>${goalName}</strong>. Start saving today!`,
      icon: emojis[goalType] || "🎯",
      badge: "Goal",
      actionType: "goal",
      actionData: { goalName, goalType },
      metadata: { goalName, goalType },
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
    console.error("Generate goal created notification error:", error);
    return null;
  }
};

// Generate System Notification
export const generateSystemNotification = async (userId, title, message, type = "system") => {
  try {
    const notificationsCollection = db.collection("notifications");
    
    const notification = {
      userId: new ObjectId(userId),
      type: type,
      title,
      message,
      icon: "🔔",
      badge: "System",
      actionType: "system",
      actionData: null,
      metadata: { type },
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
    console.error("Generate system notification error:", error);
    return null;
  }
};

// ==================== CONTROLLER FUNCTIONS ====================

// Create a notification (Admin only)
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
      type,
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

    // Also add to user's notifications array
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

// Get user's notifications
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
      withdrawal: typeCounts.find(t => t._id === "withdrawal")?.count || 0,
      transfer: typeCounts.find(t => t._id === "transfer")?.count || 0,
      streak: typeCounts.find(t => t._id === "streak")?.count || 0,
      reminder: typeCounts.find(t => t._id === "reminder")?.count || 0,
      bonus: typeCounts.find(t => t._id === "bonus")?.count || 0,
      achievement: typeCounts.find(t => t._id === "achievement")?.count || 0,
      milestone: typeCounts.find(t => t._id === "milestone")?.count || 0,
      goal: typeCounts.find(t => t._id === "goal")?.count || 0,
      zakat: typeCounts.find(t => t._id === "zakat")?.count || 0,
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
      withdrawal: true,
      transfer: true,
      streak: true,
      reminder: true,
      bonus: true,
      achievement: true,
      milestone: true,
      goal: true,
      zakat: true,
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