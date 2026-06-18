// controllers/withdrawal/withdrawal.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Create withdrawal request
export const createWithdrawal = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      goalId,
      withdrawalAmount,
      reason,
      paymentMethod,
      phoneNumber,
      bankName,
      accountNumber,
      accountHolderName,
    } = req.body;

    // Validation
    if (!goalId) {
      return res.status(400).json({
        success: false,
        message: "Goal ID is required",
      });
    }

    if (!withdrawalAmount || withdrawalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid withdrawal amount is required",
      });
    }

    if (withdrawalAmount < 100) {
      return res.status(400).json({
        success: false,
        message: "Minimum withdrawal amount is ৳100",
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason for withdrawal is required",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    // Validate payment method specific fields
    if (paymentMethod === "bkash" || paymentMethod === "nagad") {
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: `${paymentMethod === "bkash" ? "bKash" : "Nagad"} number is required`,
        });
      }
      // Validate phone number format
      const phoneRegex = /^1[3-9]\d{8}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format. Must be 11 digits starting with 1",
        });
      }
    }

    if (paymentMethod === "bank") {
      if (!bankName) {
        return res.status(400).json({
          success: false,
          message: "Bank name is required",
        });
      }
      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Account number is required",
        });
      }
      if (!accountHolderName) {
        return res.status(400).json({
          success: false,
          message: "Account holder name is required",
        });
      }
    }

    const usersCollection = db.collection("users");
    const goalsCollection = db.collection("goals");
    const withdrawalsCollection = db.collection("withdrawals");

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

    // Check if goal has enough savings
    const withdrawalAmountNum = parseFloat(withdrawalAmount);
    if (withdrawalAmountNum > goal.currentSaved) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ৳${goal.currentSaved.toLocaleString()}`,
      });
    }

    // Check if goal is completed
    if (goal.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot withdraw from a completed goal",
      });
    }

    // Check for pending withdrawal requests for this goal
    const existingPendingWithdrawal = await withdrawalsCollection.findOne({
      goalId: new ObjectId(goalId),
      status: "pending",
    });

    if (existingPendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending withdrawal request for this goal",
      });
    }

    // Create withdrawal object
    const newWithdrawal = {
      userId: new ObjectId(userId),
      goalId: new ObjectId(goalId),
      goalName: goal.goalName,
      goalType: goal.goalType,
      withdrawalAmount: withdrawalAmountNum,
      reason,
      paymentMethod,
      paymentDetails: {
        ...(paymentMethod === "bkash" || paymentMethod === "nagad" ? { phoneNumber } : {}),
        ...(paymentMethod === "bank" ? {
          bankName,
          accountNumber,
          accountHolderName,
        } : {}),
      },
      status: "pending", // pending, approved, rejected, completed
      remarks: null,
      approvedBy: null,
      approvedAt: null,
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await withdrawalsCollection.insertOne(newWithdrawal);

    const withdrawal = { ...newWithdrawal, _id: result.insertedId };

    return res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully. Admin will review within 5-7 working days.",
      data: withdrawal,
    });
  } catch (error) {
    console.error("Create withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit withdrawal request",
    });
  }
};

// Get user's withdrawal history
export const getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, goalId, page = 1, limit = 10 } = req.query;

    const withdrawalsCollection = db.collection("withdrawals");
    
    const query = { userId: new ObjectId(userId) };
    if (status && status !== "all") {
      query.status = status;
    }
    if (goalId) {
      query.goalId = new ObjectId(goalId);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const withdrawals = await withdrawalsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await withdrawalsCollection.countDocuments(query);

    // Calculate summary
    const summary = await withdrawalsCollection.aggregate([
      { $match: { userId: new ObjectId(userId), status: "approved" } },
      {
        $group: {
          _id: null,
          totalWithdrawn: { $sum: "$withdrawalAmount" },
          totalWithdrawals: { $sum: 1 },
        },
      },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        withdrawals,
        summary: {
          totalWithdrawn: summary[0]?.totalWithdrawn || 0,
          totalWithdrawals: summary[0]?.totalWithdrawals || 0,
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get user withdrawals error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch withdrawals",
    });
  }
};

// Get single withdrawal by ID
export const getWithdrawalById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID",
      });
    }

    const withdrawalsCollection = db.collection("withdrawals");
    const withdrawal = await withdrawalsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Get withdrawal by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch withdrawal",
    });
  }
};

// Admin: Get all withdrawals
export const getAllWithdrawals = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const withdrawalsCollection = db.collection("withdrawals");
    
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const withdrawals = await withdrawalsCollection
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
            goalName: 1,
            goalType: 1,
            withdrawalAmount: 1,
            reason: 1,
            paymentMethod: 1,
            paymentDetails: 1,
            status: 1,
            remarks: 1,
            createdAt: 1,
            "user.fullName": 1,
            "user.email": 1,
            "user.phone": 1,
            "user.createdAt" : 1,
          },
        },
      ])
      .toArray();

    const total = await withdrawalsCollection.countDocuments(query);

    // Get statistics
    const statistics = await withdrawalsCollection.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$withdrawalAmount" },
        },
      },
    ]).toArray();

    const stats = {
      pending: statistics.find(s => s._id === "pending") || { count: 0, totalAmount: 0 },
      approved: statistics.find(s => s._id === "approved") || { count: 0, totalAmount: 0 },
      rejected: statistics.find(s => s._id === "rejected") || { count: 0, totalAmount: 0 },
      completed: statistics.find(s => s._id === "completed") || { count: 0, totalAmount: 0 },
    };

    return res.status(200).json({
      success: true,
      data: {
        withdrawals,
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
    console.error("Get all withdrawals error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch withdrawals",
    });
  }
};

// Admin: Approve withdrawal
export const approveWithdrawal = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { id } = req.params;
    const { remarks } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID",
      });
    }

    const withdrawalsCollection = db.collection("withdrawals");
    const goalsCollection = db.collection("goals");
    const usersCollection = db.collection("users");

    const withdrawal = await withdrawalsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Withdrawal is already ${withdrawal.status}`,
      });
    }

    // Update withdrawal status
    await withdrawalsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "approved",
          remarks: remarks || null,
          approvedBy: new ObjectId(adminId),
          approvedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Update goal's currentSaved and progress
    const goal = await goalsCollection.findOne({
      _id: withdrawal.goalId,
    });

    if (goal) {
      const newCurrentSaved = Math.max(0, (goal.currentSaved || 0) - withdrawal.withdrawalAmount);
      const newProgress = Math.min(Math.round((newCurrentSaved / goal.targetAmount) * 100), 100);
      
      // Update goal in goals collection
      const updateFields = {
        currentSaved: newCurrentSaved,
        progress: newProgress,
        updatedAt: new Date(),
      };
      
      await goalsCollection.updateOne(
        { _id: withdrawal.goalId },
        { $set: updateFields }
      );

      // Update user's goals array
      await usersCollection.updateOne(
        { 
          _id: withdrawal.userId,
          "goals.goalId": withdrawal.goalId 
        },
        {
          $set: {
            "goals.$.currentSaved": newCurrentSaved,
            "goals.$.progress": newProgress,
            "goals.$.updatedAt": new Date(),
          }
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Withdrawal approved successfully",
    });
  } catch (error) {
    console.error("Approve withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve withdrawal",
    });
  }
};

// Admin: Reject withdrawal
export const rejectWithdrawal = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { id } = req.params;
    const { remarks } = req.body;

    if (!remarks) {
      return res.status(400).json({
        success: false,
        message: "Remarks are required for rejection",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID",
      });
    }

    const withdrawalsCollection = db.collection("withdrawals");

    const withdrawal = await withdrawalsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Withdrawal is already ${withdrawal.status}`,
      });
    }

    // Update withdrawal status
    await withdrawalsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "rejected",
          remarks,
          approvedBy: new ObjectId(adminId),
          approvedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Withdrawal rejected successfully",
    });
  } catch (error) {
    console.error("Reject withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reject withdrawal",
    });
  }
};

// Admin: Mark withdrawal as completed (payment sent)
export const completeWithdrawal = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { id } = req.params;
    const { transactionId, remarks } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID",
      });
    }

    const withdrawalsCollection = db.collection("withdrawals");

    const withdrawal = await withdrawalsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    if (withdrawal.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved withdrawals can be marked as completed",
      });
    }

    // Update withdrawal status
    await withdrawalsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "completed",
          transactionId: transactionId || null,
          remarks: remarks || withdrawal.remarks,
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Withdrawal marked as completed",
    });
  } catch (error) {
    console.error("Complete withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to complete withdrawal",
    });
  }
};

// Get withdrawal statistics for user
export const getWithdrawalStatistics = async (req, res) => {
  try {
    const userId = req.user._id;

    const withdrawalsCollection = db.collection("withdrawals");

    const statistics = await withdrawalsCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$withdrawalAmount" },
        },
      },
    ]).toArray();

    const stats = {
      pending: statistics.find(s => s._id === "pending") || { count: 0, totalAmount: 0 },
      approved: statistics.find(s => s._id === "approved") || { count: 0, totalAmount: 0 },
      rejected: statistics.find(s => s._id === "rejected") || { count: 0, totalAmount: 0 },
      completed: statistics.find(s => s._id === "completed") || { count: 0, totalAmount: 0 },
      totalWithdrawn: statistics.find(s => s._id === "completed")?.totalAmount || 0,
    };

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get withdrawal statistics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch statistics",
    });
  }
};