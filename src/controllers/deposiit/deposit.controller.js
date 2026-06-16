// controllers/deposit/deposit.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

export const uploadDepositScreenshot = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Screenshot uploaded successfully",
      data: {
        url: req.file.path,
        publicId: req.file.filename,
      },
    });
  } catch (error) {
    console.error("Upload deposit screenshot error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload screenshot",
    });
  }
};

// Create a new deposit request
export const createDeposit = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      goalId,
      depositAmount,
      paymentMethod,
      transactionReference,
      screenshotUrl,
      screenshotPublicId,
    } = req.body;

    // Validation
    if (!goalId) {
      return res.status(400).json({
        success: false,
        message: "Goal ID is required",
      });
    }

    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid deposit amount is required",
      });
    }

    if (depositAmount < 100) {
      return res.status(400).json({
        success: false,
        message: "Minimum deposit amount is ৳100",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (!screenshotUrl || !screenshotPublicId) {
      return res.status(400).json({
        success: false,
        message: "Transaction screenshot is required",
      });
    }

    const usersCollection = db.collection("users");
    const goalsCollection = db.collection("goals");
    const depositsCollection = db.collection("deposits");

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
        message: "Cannot deposit to a completed goal",
      });
    }

    // Convert to number
    const depositAmountNum = parseFloat(depositAmount);
    
    // Create deposit object
    const newDeposit = {
      userId: new ObjectId(userId),
      goalId: new ObjectId(goalId),
      goalName: goal.goalName,
      goalType: goal.goalType,
      depositAmount: depositAmountNum,
      paymentMethod,
      transactionReference: transactionReference || null,
      screenshot: {
        url: screenshotUrl,
        publicId: screenshotPublicId,
      },
      status: "pending",
      remarks: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await depositsCollection.insertOne(newDeposit);
    const deposit = { ...newDeposit, _id: result.insertedId };

    return res.status(201).json({
      success: true,
      message: "Deposit request submitted successfully. Awaiting verification.",
      data: deposit,
    });
  } catch (error) {
    console.error("Create deposit error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit deposit",
    });
  }
};

// Get user's deposit history
export const getUserDeposits = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, goalId, page = 1, limit = 10 } = req.query;

    const depositsCollection = db.collection("deposits");
    
    const query = { userId: new ObjectId(userId) };
    if (status && status !== "all") {
      query.status = status;
    }
    if (goalId) {
      query.goalId = new ObjectId(goalId);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const deposits = await depositsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await depositsCollection.countDocuments(query);

    // Calculate summary
    const summary = await depositsCollection.aggregate([
      { $match: { userId: new ObjectId(userId), status: "approved" } },
      {
        $group: {
          _id: null,
          totalDeposited: { $sum: "$depositAmount" },
          totalDeposits: { $sum: 1 },
        },
      },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        deposits,
        summary: {
          totalDeposited: summary[0]?.totalDeposited || 0,
          totalDeposits: summary[0]?.totalDeposits || 0,
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
    console.error("Get user deposits error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch deposits",
    });
  }
};

// Get single deposit by ID
export const getDepositById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid deposit ID",
      });
    }

    const depositsCollection = db.collection("deposits");
    const deposit = await depositsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Deposit not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: deposit,
    });
  } catch (error) {
    console.error("Get deposit by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch deposit",
    });
  }
};

// Admin: Get all deposits (with aggregation for goal info)
export const getAllDeposits = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const depositsCollection = db.collection("deposits");

    
    
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const deposits = await depositsCollection
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
  depositAmount: 1,
  paymentMethod: 1,
  transactionReference: 1,
  screenshot: 1,
  status: 1,
  remarks: 1,
  createdAt: 1,
  "user.fullName": 1, 
  "user.email": 1,
  "user.phone": 1,
  "user.createdAt": 1, 
},
        },
      ])
      .toArray();

    const total = await depositsCollection.countDocuments(query);

    // Get statistics
    const statistics = await depositsCollection.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$depositAmount" },
        },
      },
    ]).toArray();

    const stats = {
      pending: statistics.find(s => s._id === "pending") || { count: 0, totalAmount: 0 },
      approved: statistics.find(s => s._id === "approved") || { count: 0, totalAmount: 0 },
      rejected: statistics.find(s => s._id === "rejected") || { count: 0, totalAmount: 0 },
    };

    return res.status(200).json({
      success: true,
      data: {
        deposits,
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
    console.error("Get all deposits error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch deposits",
    });
  }
};

// Admin: Approve deposit (FIXED VERSION)
// Admin: Approve deposit (COMPLETELY FIXED VERSION)
export const approveDeposit = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { id } = req.params;
    const { remarks } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid deposit ID",
      });
    }

    const depositsCollection = db.collection("deposits");
    const goalsCollection = db.collection("goals");
    const usersCollection = db.collection("users");

    // Get the deposit
    const deposit = await depositsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Deposit not found",
      });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Deposit is already ${deposit.status}`,
      });
    }

    // Get the goal
    const goal = await goalsCollection.findOne({
      _id: deposit.goalId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found for this deposit",
      });
    }

    // Calculate new values
    const oldCurrentSaved = goal.currentSaved || 0;
    const newCurrentSaved = oldCurrentSaved + deposit.depositAmount;
    const newProgress = Math.min(Math.round((newCurrentSaved / goal.targetAmount) * 100), 100);
    
    console.log("=== DEPOSIT APPROVAL DEBUG ===");
    console.log("Deposit ID:", id);
    console.log("Goal ID:", deposit.goalId);
    console.log("Old Current Saved:", oldCurrentSaved);
    console.log("Deposit Amount:", deposit.depositAmount);
    console.log("New Current Saved:", newCurrentSaved);
    console.log("Target Amount:", goal.targetAmount);
    console.log("New Progress:", newProgress);
    
    // Update deposit status
    const depositUpdate = await depositsCollection.updateOne(
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
    
    console.log("Deposit update result:", depositUpdate);

    // Update goal in goals collection
    const goalUpdateData = {
      currentSaved: newCurrentSaved,
      progress: newProgress,
      updatedAt: new Date(),
    };
    
    if (newCurrentSaved >= goal.targetAmount) {
      goalUpdateData.status = "completed";
      goalUpdateData.progress = 100;
    }
    
    const goalUpdate = await goalsCollection.updateOne(
      { _id: deposit.goalId },
      { $set: goalUpdateData }
    );
    
    console.log("Goal update result:", goalUpdate);
    console.log("Goal update data:", goalUpdateData);

    // Update user's goals array
    const userGoalUpdate = await usersCollection.updateOne(
      { 
        _id: deposit.userId,
        "goals.goalId": deposit.goalId 
      },
      {
        $set: {
          "goals.$.currentSaved": newCurrentSaved,
          "goals.$.progress": newProgress,
          "goals.$.status": newCurrentSaved >= goal.targetAmount ? "completed" : "active",
          "goals.$.updatedAt": new Date(),
        }
      }
    );
    
    console.log("User goal update result:", userGoalUpdate);
    
    // If goal not found in user's array, push it
    if (userGoalUpdate.matchedCount === 0) {
      console.log("Goal not found in user array, pushing new entry...");
      await usersCollection.updateOne(
        { _id: deposit.userId },
        {
          $push: {
            goals: {
              goalId: deposit.goalId,
              goalName: goal.goalName,
              goalType: goal.goalType,
              targetAmount: goal.targetAmount,
              monthlyDeposit: goal.monthlyDeposit,
              currentSaved: newCurrentSaved,
              progress: newProgress,
              status: newCurrentSaved >= goal.targetAmount ? "completed" : "active",
              targetDate: goal.targetDate,
              estimatedCompletionDate: goal.estimatedCompletionDate,
              createdAt: goal.createdAt || new Date(),
              updatedAt: new Date(),
            }
          }
        }
      );
    }
    
    // Verify the update
    const verifyGoal = await goalsCollection.findOne({ _id: deposit.goalId });
    console.log("VERIFICATION - Goal after update:", {
      currentSaved: verifyGoal.currentSaved,
      progress: verifyGoal.progress,
      status: verifyGoal.status
    });
    
    if (verifyGoal.currentSaved !== newCurrentSaved) {
      console.error("WARNING: Goal currentSaved did not update correctly!");
      console.error(`Expected: ${newCurrentSaved}, Got: ${verifyGoal.currentSaved}`);
    }

    return res.status(200).json({
      success: true,
      message: "Deposit approved successfully",
      data: {
        deposit: { ...deposit, status: "approved" },
        goal: {
          oldCurrentSaved,
          newCurrentSaved,
          progress: newProgress,
          completed: newCurrentSaved >= goal.targetAmount
        }
      }
    });
  } catch (error) {
    console.error("Approve deposit error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve deposit",
    });
  }
};

// Admin: Reject deposit
export const rejectDeposit = async (req, res) => {
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
        message: "Invalid deposit ID",
      });
    }

    const depositsCollection = db.collection("deposits");

    const deposit = await depositsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Deposit not found",
      });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Deposit is already ${deposit.status}`,
      });
    }

    // Update deposit status
    await depositsCollection.updateOne(
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
      message: "Deposit rejected successfully",
    });
  } catch (error) {
    console.error("Reject deposit error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reject deposit",
    });
  }
};

// Get deposit statistics for user
export const getDepositStatistics = async (req, res) => {
  try {
    const userId = req.user._id;

    const depositsCollection = db.collection("deposits");

    const statistics = await depositsCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$depositAmount" },
        },
      },
    ]).toArray();

    const stats = {
      pending: statistics.find(s => s._id === "pending") || { count: 0, totalAmount: 0 },
      approved: statistics.find(s => s._id === "approved") || { count: 0, totalAmount: 0 },
      rejected: statistics.find(s => s._id === "rejected") || { count: 0, totalAmount: 0 },
      totalApproved: statistics.find(s => s._id === "approved")?.totalAmount || 0,
    };

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get deposit statistics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch statistics",
    });
  }
};

// Debug endpoint to check goal currentSaved
export const debugGoalDeposit = async (req, res) => {
  try {
    const userId = req.user._id;
    const { goalId } = req.params;

    const goalsCollection = db.collection("goals");
    const depositsCollection = db.collection("deposits");
    const usersCollection = db.collection("users");

    const goal = await goalsCollection.findOne({
      _id: new ObjectId(goalId),
      userId: new ObjectId(userId),
    });

    const approvedDeposits = await depositsCollection
      .find({
        goalId: new ObjectId(goalId),
        status: "approved"
      })
      .toArray();

    const totalApprovedDeposits = approvedDeposits.reduce(
      (sum, d) => sum + d.depositAmount,
      0
    );

    const user = await usersCollection.findOne(
      { 
        _id: new ObjectId(userId),
        "goals.goalId": new ObjectId(goalId)
      },
      { projection: { "goals.$": 1 } }
    );

    return res.status(200).json({
      success: true,
      data: {
        goal: {
          currentSaved: goal?.currentSaved || 0,
          progress: goal?.progress || 0,
          targetAmount: goal?.targetAmount || 0,
        },
        totalApprovedDeposits,
        userGoalFromArray: user?.goals?.[0],
        isSynced: goal?.currentSaved === totalApprovedDeposits,
      },
    });
  } catch (error) {
    console.error("Debug goal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};