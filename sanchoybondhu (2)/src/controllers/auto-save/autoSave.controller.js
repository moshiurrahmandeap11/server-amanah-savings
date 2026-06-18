// controllers/auto-save/autoSave.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Create auto-save rule
export const createAutoSaveRule = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      goalId,
      frequency,
      amount,
      paymentMethod,
      weeklyDays,
      monthlyDate,
      startDate,
    } = req.body;

    // Validation
    if (!goalId) {
      return res.status(400).json({
        success: false,
        message: "Goal ID is required",
      });
    }

    if (!frequency || !["daily", "weekly", "monthly"].includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: "Valid frequency is required (daily/weekly/monthly)",
      });
    }

    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        message: "Minimum auto-save amount is ৳10",
      });
    }

    if (!paymentMethod || !["bkash", "nagad"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Valid payment method is required (bkash/nagad)",
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: "Start date is required",
      });
    }

    const amountNum = parseFloat(amount);
    const usersCollection = db.collection("users");
    const goalsCollection = db.collection("goals");
    const autoSaveRulesCollection = db.collection("auto_save_rules");

    // Check if user exists
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if goal exists and belongs to user
    const goal = await goalsCollection.findOne({
      _id: new ObjectId(goalId),
      userId: new ObjectId(userId),
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found",
      });
    }

    if (goal.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot create auto-save for completed goal",
      });
    }

    // Calculate next execution date
    const nextExecutionDate = calculateNextExecutionDate(
      frequency,
      weeklyDays,
      monthlyDate,
      new Date(startDate)
    );

    // Create auto-save rule
    const newRule = {
      userId: new ObjectId(userId),
      goalId: new ObjectId(goalId),
      goalName: goal.goalName,
      goalType: goal.goalType,
      amount: amountNum,
      frequency,
      paymentMethod,
      weeklyDays: frequency === "weekly" ? weeklyDays : null,
      monthlyDate: frequency === "monthly" ? monthlyDate : null,
      startDate: new Date(startDate),
      nextExecutionDate,
      lastExecutedAt: null,
      status: "active", // active, paused, cancelled
      totalSaved: 0,
      timesRun: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await autoSaveRulesCollection.insertOne(newRule);
    const rule = { ...newRule, _id: result.insertedId };

    return res.status(201).json({
      success: true,
      message: "Auto-save rule created successfully",
      data: rule,
    });
  } catch (error) {
    console.error("Create auto-save rule error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create auto-save rule",
    });
  }
};

// Calculate next execution date
const calculateNextExecutionDate = (frequency, weeklyDays, monthlyDate, startDate) => {
  const now = new Date();
  let nextDate = new Date(startDate);
  
  // If start date is in the past, calculate next occurrence
  if (nextDate <= now) {
    if (frequency === "daily") {
      nextDate = new Date(now);
      nextDate.setDate(now.getDate() + 1);
      nextDate.setHours(0, 0, 0, 0);
    } else if (frequency === "weekly") {
      const currentDay = now.getDay();
      const nextDay = weeklyDays.find(day => day > currentDay);
      if (nextDay !== undefined) {
        nextDate = new Date(now);
        nextDate.setDate(now.getDate() + (nextDay - currentDay));
      } else {
        nextDate = new Date(now);
        nextDate.setDate(now.getDate() + (7 - currentDay + weeklyDays[0]));
      }
      nextDate.setHours(0, 0, 0, 0);
    } else if (frequency === "monthly") {
      let targetDate = monthlyDate;
      let currentDate = now.getDate();
      if (targetDate > currentDate) {
        nextDate = new Date(now);
        nextDate.setDate(targetDate);
      } else {
        nextDate = new Date(now);
        nextDate.setMonth(now.getMonth() + 1);
        nextDate.setDate(targetDate);
      }
      nextDate.setHours(0, 0, 0, 0);
    }
  } else {
    nextDate.setHours(0, 0, 0, 0);
  }
  
  return nextDate;
};

// Get user's auto-save rules
export const getUserAutoSaveRules = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const autoSaveRulesCollection = db.collection("auto_save_rules");
    
    const query = { userId: new ObjectId(userId) };
    if (status && status !== "all") {
      query.status = status;
    }

    const rules = await autoSaveRulesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Get statistics
    const stats = await autoSaveRulesCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalSaved: { $sum: "$totalSaved" },
          totalRules: { $sum: 1 },
          activeRules: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
          },
        },
      },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        rules,
        statistics: {
          totalSaved: stats[0]?.totalSaved || 0,
          totalRules: stats[0]?.totalRules || 0,
          activeRules: stats[0]?.activeRules || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get auto-save rules error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch auto-save rules",
    });
  }
};

// Get single auto-save rule by ID
export const getAutoSaveRuleById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rule ID",
      });
    }

    const autoSaveRulesCollection = db.collection("auto_save_rules");
    const rule = await autoSaveRulesCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Auto-save rule not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error("Get auto-save rule error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch rule",
    });
  }
};

// Update auto-save rule
export const updateAutoSaveRule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const {
      amount,
      frequency,
      weeklyDays,
      monthlyDate,
      startDate,
      status,
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rule ID",
      });
    }

    const autoSaveRulesCollection = db.collection("auto_save_rules");
    
    const existingRule = await autoSaveRulesCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!existingRule) {
      return res.status(404).json({
        success: false,
        message: "Auto-save rule not found",
      });
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (amount !== undefined) {
      updateData.amount = parseFloat(amount);
    }
    if (frequency !== undefined) {
      updateData.frequency = frequency;
    }
    if (weeklyDays !== undefined) {
      updateData.weeklyDays = weeklyDays;
    }
    if (monthlyDate !== undefined) {
      updateData.monthlyDate = monthlyDate;
    }
    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
    }
    if (status !== undefined) {
      updateData.status = status;
    }

    // Recalculate next execution date if frequency or schedule changed
    if (frequency !== undefined || weeklyDays !== undefined || monthlyDate !== undefined || startDate !== undefined) {
      const newFrequency = frequency || existingRule.frequency;
      const newWeeklyDays = weeklyDays || existingRule.weeklyDays;
      const newMonthlyDate = monthlyDate || existingRule.monthlyDate;
      const newStartDate = startDate ? new Date(startDate) : existingRule.startDate;
      
      updateData.nextExecutionDate = calculateNextExecutionDate(
        newFrequency,
        newWeeklyDays,
        newMonthlyDate,
        newStartDate
      );
    }

    const result = await autoSaveRulesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes made to the rule",
      });
    }

    const updatedRule = await autoSaveRulesCollection.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "Auto-save rule updated successfully",
      data: updatedRule,
    });
  } catch (error) {
    console.error("Update auto-save rule error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update rule",
    });
  }
};

// Pause auto-save rule
export const pauseAutoSaveRule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rule ID",
      });
    }

    const autoSaveRulesCollection = db.collection("auto_save_rules");
    
    const rule = await autoSaveRulesCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Auto-save rule not found",
      });
    }

    if (rule.status === "paused") {
      return res.status(400).json({
        success: false,
        message: "Rule is already paused",
      });
    }

    await autoSaveRulesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "paused",
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Auto-save rule paused successfully",
    });
  } catch (error) {
    console.error("Pause auto-save rule error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to pause rule",
    });
  }
};

// Resume auto-save rule
export const resumeAutoSaveRule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rule ID",
      });
    }

    const autoSaveRulesCollection = db.collection("auto_save_rules");
    
    const rule = await autoSaveRulesCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Auto-save rule not found",
      });
    }

    if (rule.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Rule is already active",
      });
    }

    // Recalculate next execution date
    const nextExecutionDate = calculateNextExecutionDate(
      rule.frequency,
      rule.weeklyDays,
      rule.monthlyDate,
      new Date()
    );

    await autoSaveRulesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "active",
          nextExecutionDate,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Auto-save rule resumed successfully",
    });
  } catch (error) {
    console.error("Resume auto-save rule error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to resume rule",
    });
  }
};

// Delete auto-save rule
export const deleteAutoSaveRule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rule ID",
      });
    }

    const autoSaveRulesCollection = db.collection("auto_save_rules");
    
    const rule = await autoSaveRulesCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Auto-save rule not found",
      });
    }

    const result = await autoSaveRulesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Rule not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Auto-save rule deleted successfully",
    });
  } catch (error) {
    console.error("Delete auto-save rule error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete rule",
    });
  }
};

// Admin: Get all auto-save rules
export const getAllAutoSaveRules = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const autoSaveRulesCollection = db.collection("auto_save_rules");
    
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const rules = await autoSaveRulesCollection
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
          $lookup: {
            from: "goals",
            localField: "goalId",
            foreignField: "_id",
            as: "goal",
          },
        },
        {
          $project: {
            _id: 1,
            amount: 1,
            frequency: 1,
            paymentMethod: 1,
            status: 1,
            totalSaved: 1,
            timesRun: 1,
            nextExecutionDate: 1,
            createdAt: 1,
            "user.name": 1,
            "user.email": 1,
            "user.phone": 1,
            "goal.goalName": 1,
          },
        },
      ])
      .toArray();

    const total = await autoSaveRulesCollection.countDocuments(query);

    // Get statistics
    const statistics = await autoSaveRulesCollection.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalSaved" },
        },
      },
    ]).toArray();

    const stats = {
      active: statistics.find(s => s._id === "active") || { count: 0, totalAmount: 0 },
      paused: statistics.find(s => s._id === "paused") || { count: 0, totalAmount: 0 },
      cancelled: statistics.find(s => s._id === "cancelled") || { count: 0, totalAmount: 0 },
    };

    return res.status(200).json({
      success: true,
      data: {
        rules,
        statistics: stats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get all auto-save rules error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch rules",
    });
  }
};

// Get auto-save statistics for user
export const getAutoSaveStatistics = async (req, res) => {
  try {
    const userId = req.user._id;

    const autoSaveRulesCollection = db.collection("auto_save_rules");

    const statistics = await autoSaveRulesCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalSaved: { $sum: "$totalSaved" },
          totalTimesRun: { $sum: "$timesRun" },
        },
      },
    ]).toArray();

    const monthlyProjection = await autoSaveRulesCollection.aggregate([
      { $match: { userId: new ObjectId(userId), status: "active" } },
      {
        $group: {
          _id: null,
          monthlyTotal: { $sum: "$amount" },
        },
      },
    ]).toArray();

    const stats = {
      active: statistics.find(s => s._id === "active") || { count: 0, totalSaved: 0, totalTimesRun: 0 },
      paused: statistics.find(s => s._id === "paused") || { count: 0, totalSaved: 0, totalTimesRun: 0 },
      totalSaved: statistics.reduce((sum, s) => sum + (s.totalSaved || 0), 0),
      totalTimesRun: statistics.reduce((sum, s) => sum + (s.totalTimesRun || 0), 0),
      monthlyProjection: monthlyProjection[0]?.monthlyTotal || 0,
    };

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get auto-save statistics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch statistics",
    });
  }
};