// controllers/deposit/deposit.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";
import { applyReferralBonusForApprovedDeposit } from "../referral/referral.controller.js";
import {
  defaultPaymentInstructions,
  normalizePaymentInstructions,
} from "../admin/admin.controller.js";

export const getPaymentInstructions = async (req, res) => {
  try {
    const settings = await db
      .collection("platform_settings")
      .findOne({ key: "platform" }, { projection: { "payments.instructions": 1 } });

    return res.status(200).json({
      success: true,
      data: normalizePaymentInstructions(
        settings?.payments?.instructions || defaultPaymentInstructions,
      ),
    });
  } catch (error) {
    console.error("Get payment instructions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payment instructions",
    });
  }
};

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
      depositType = "goal",
      goalId,
      circleId,
      depositAmount,
      paymentMethod,
      transactionReference,
      screenshotUrl,
      screenshotPublicId,
    } = req.body;

    // Validation
    const isCircleDeposit = depositType === "circle" || Boolean(circleId);
    if (!isCircleDeposit && !goalId) {
      return res.status(400).json({
        success: false,
        message: "Goal ID is required",
      });
    }

    if (isCircleDeposit && !circleId) {
      return res.status(400).json({
        success: false,
        message: "Circle ID is required",
      });
    }

    const depositAmountNum = Number(depositAmount);

    if (!Number.isFinite(depositAmountNum) || depositAmountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid deposit amount is required",
      });
    }

    if (depositAmountNum < 100) {
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
    const circlesCollection = db.collection("circles");
    const depositsCollection = db.collection("deposits");

    // Check if user exists
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let goal = null;
    let circle = null;
    let depositTarget = null;

    if (isCircleDeposit) {
      if (!ObjectId.isValid(circleId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid circle ID",
        });
      }

      circle = await circlesCollection.findOne({
        _id: new ObjectId(circleId),
        status: "active",
        "members.userId": new ObjectId(userId),
      });

      if (!circle) {
        return res.status(404).json({
          success: false,
          message: "Circle not found or you are not a member",
        });
      }

      depositTarget = {
        targetType: "circle",
        circleId: circle._id,
        goalName: circle.circleName,
        goalType: circle.purpose || "circle",
      };
    } else {
      if (!ObjectId.isValid(goalId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid goal ID",
        });
      }

      // Check if goal exists and belongs to user
      goal = await goalsCollection.findOne({
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

      // Check if goal target is already reached
      const currentSaved = Number(goal.currentSaved) || 0;
      const targetAmount = Number(goal.targetAmount) || 0;
      if (targetAmount > 0 && currentSaved >= targetAmount) {
        return res.status(400).json({
          success: false,
          message: `Goal target of ৳${targetAmount.toLocaleString()} has already been reached. No more deposits are accepted.`,
        });
      }
      if (targetAmount > 0 && currentSaved + depositAmountNum > targetAmount) {
        const remaining = Math.max(0, targetAmount - currentSaved);
        return res.status(400).json({
          success: false,
          message: `Deposit would exceed the goal target of ৳${targetAmount.toLocaleString()}. Current saved: ৳${currentSaved.toLocaleString()}. You can deposit maximum ৳${remaining.toLocaleString()}.`,
          data: { targetAmount, currentSaved, remaining, requestedAmount: depositAmountNum },
        });
      }

      depositTarget = {
        targetType: "goal",
        goalId: goal._id,
        goalName: goal.goalName,
        goalType: goal.goalType,
      };
    }

    // ===== PLAN LIMIT VALIDATION =====
    // Check user's plan and enforce monthly deposit limit
    const userPlan = user.selectedPlan || "bronze";
    const userBillingCycle = user.billingCycle || "monthly";
    const userPlanFee = Number(user.planFee) || 0;
    
    // Get plan limits from CMS (fallback to hardcoded defaults)
    const cmsCollection = db.collection("cms_content");
    const cms = await cmsCollection.findOne({ key: "cms" });
    const cmsPlans = cms?.plans || [];
    const planConfig = cmsPlans.find(p => 
      (p.name || "").toLowerCase() === userPlan.toLowerCase()
    );
    
    // Determine max deposit allowed based on plan
    let maxDepositAllowed = 10000; // Default Bronze max
    if (planConfig?.max) {
      maxDepositAllowed = Number(planConfig.max);
    } else {
      // Fallback hardcoded limits
      const planLimits = { bronze: 10000, silver: 25000, gold: 100000, platinum: 500000 };
      maxDepositAllowed = planLimits[userPlan.toLowerCase()] || 10000;
    }
    
    // Check if this deposit would exceed the plan's monthly limit
    // Get total deposits this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    const monthlyDeposits = await depositsCollection
      .find({
        userId: new ObjectId(userId),
        status: { $in: ["pending", "approved"] },
        createdAt: { $gte: startOfMonth, $lt: endOfMonth },
      })
      .toArray();
    
    const totalMonthlyDeposited = monthlyDeposits.reduce(
      (sum, d) => sum + Number(d.depositAmount || 0), 
      0
    );
    
    // If adding this deposit would exceed the plan limit, reject it
    if (totalMonthlyDeposited + depositAmountNum > maxDepositAllowed) {
      const remaining = Math.max(0, maxDepositAllowed - totalMonthlyDeposited);
      const higherPlans = Object.entries(planLimits)
        .filter(([plan, limit]) => limit > maxDepositAllowed)
        .sort((a, b) => a[1] - b[1]);
      const upgradeSuggestion = higherPlans.length > 0 
        ? ` Consider upgrading to ${higherPlans[0][0].charAt(0).toUpperCase() + higherPlans[0][0].slice(1)} plan (৳${higherPlans[0][1].toLocaleString()} limit) from your dashboard settings.` 
        : "";
      return res.status(400).json({
        success: false,
        message: `Plan limit exceeded! Your ${userPlan} plan allows maximum ৳${maxDepositAllowed.toLocaleString()} per month. You have already deposited ৳${totalMonthlyDeposited.toLocaleString()} this month. Remaining limit: ৳${remaining.toLocaleString()}.${upgradeSuggestion}`,
        data: {
          plan: userPlan,
          planLimit: maxDepositAllowed,
          depositedThisMonth: totalMonthlyDeposited,
          remainingLimit: remaining,
          requestedAmount: depositAmountNum,
          canUpgrade: higherPlans.length > 0,
          suggestedPlan: higherPlans.length > 0 ? higherPlans[0][0] : null,
        },
      });
    }
    // ===== END PLAN LIMIT VALIDATION =====

    if (isCircleDeposit && circle?.minDeposit && depositAmountNum < Number(circle.minDeposit)) {
      return res.status(400).json({
        success: false,
        message: `Minimum deposit for this circle is ৳${Number(circle.minDeposit).toLocaleString()}`,
      });
    }

    // ===== CIRCLE TARGET REACHED CHECK =====
    if (isCircleDeposit && circle) {
      const currentPool = Number(circle.totalPool) || 0;
      const targetAmount = Number(circle.targetAmount) || 0;
      if (targetAmount > 0 && currentPool >= targetAmount) {
        return res.status(400).json({
          success: false,
          message: `This circle has already reached its target of ৳${targetAmount.toLocaleString()}. No more deposits are accepted.`,
        });
      }
      if (targetAmount > 0 && currentPool + depositAmountNum > targetAmount) {
        const remaining = Math.max(0, targetAmount - currentPool);
        return res.status(400).json({
          success: false,
          message: `Deposit would exceed the circle target of ৳${targetAmount.toLocaleString()}. Current pool: ৳${currentPool.toLocaleString()}. You can deposit maximum ৳${remaining.toLocaleString()}.`,
          data: { targetAmount, currentPool, remaining, requestedAmount: depositAmountNum },
        });
      }
    }
    // ===== END CIRCLE TARGET REACHED CHECK =====
    
    // Create deposit object
    const newDeposit = {
      userId: new ObjectId(userId),
      ...depositTarget,
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
  targetType: 1,
  circleId: 1,
  goalId: 1,
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
    const circlesCollection = db.collection("circles");
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

    if (deposit.targetType === "circle" || deposit.circleId) {
      const circle = await circlesCollection.findOne({
        _id: deposit.circleId,
        "members.userId": deposit.userId,
      });

      if (!circle) {
        return res.status(404).json({
          success: false,
          message: "Circle not found for this deposit",
        });
      }

      const now = new Date();
      await depositsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: "approved",
            remarks: remarks || null,
            approvedBy: new ObjectId(adminId),
            approvedAt: now,
            updatedAt: now,
          },
        }
      );

      const newTotalPool = (Number(circle.totalPool) || 0) + deposit.depositAmount;
      await circlesCollection.updateOne(
        {
          _id: circle._id,
          "members.userId": deposit.userId,
        },
        {
          $inc: {
            totalPool: deposit.depositAmount,
            "members.$.totalDeposited": deposit.depositAmount,
          },
          $set: { updatedAt: now },
        }
      );

      await usersCollection.updateOne(
        {
          _id: deposit.userId,
          "circles.circleId": circle._id,
        },
        {
          $inc: {
            "circles.$.totalDeposited": deposit.depositAmount,
            totalSaved: deposit.depositAmount,
            totalDeposits: 1,
          },
          $set: {
            "circles.$.updatedAt": now,
            updatedAt: now,
          },
        }
      );

      let referralBonus = null;
      try {
        referralBonus = await applyReferralBonusForApprovedDeposit({
          userId: deposit.userId,
          depositAmount: deposit.depositAmount,
        });
      } catch (bonusError) {
        console.error("Referral bonus processing error:", bonusError);
        referralBonus = {
          applied: false,
          reason: "processing_failed",
          message: bonusError.message || "Referral bonus processing failed",
        };
      }

      return res.status(200).json({
        success: true,
        message: "Circle deposit approved successfully",
        data: {
          deposit: { ...deposit, status: "approved" },
          circle: {
            circleId: circle._id,
            oldTotalPool: circle.totalPool || 0,
            newTotalPool,
          },
          referralBonus,
        },
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

    let referralBonus = null;
    try {
      referralBonus = await applyReferralBonusForApprovedDeposit({
        userId: deposit.userId,
        depositAmount: deposit.depositAmount,
      });
    } catch (bonusError) {
      console.error("Referral bonus processing error:", bonusError);
      referralBonus = {
        applied: false,
        reason: "processing_failed",
        message: bonusError.message || "Referral bonus processing failed",
      };
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
        },
        referralBonus,
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
