// controllers/plan/plan.controller.js
import { ObjectId } from "mongodb";
import { db } from "../../database/db.js";
import jwt from "jsonwebtoken";

// Plan configuration (same as auth.controller.js)
const PLAN_CONFIG = {
  bronze:   { monthlyFee: 0,   yearlyFee: 0,   maxDeposit: 10000,  minMonthly: 500,   maxMonthly: 2000 },
  silver:   { monthlyFee: 199, yearlyFee: 159, maxDeposit: 25000,  minMonthly: 2000,  maxMonthly: 10000 },
  gold:     { monthlyFee: 499, yearlyFee: 399, maxDeposit: 100000, minMonthly: 10000, maxMonthly: 50000 },
  platinum: { monthlyFee: 999, yearlyFee: 799, maxDeposit: 500000, minMonthly: 50000, maxMonthly: Infinity },
  custom:   { monthlyFee: 0,   yearlyFee: 0,   maxDeposit: 10000,  minMonthly: 0,     maxMonthly: Infinity },
};

// Helper: generate token with updated plan
const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    phone: user.phone,
    role: user.role || "user",
    plan: user.selectedPlan || "bronze",
    level: user.level || 1,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// ==================== CREATE PLAN UPGRADE REQUEST ====================
export const createPlanUpgradeRequest = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const {
      selectedPlan,
      billingCycle,
      paymentMethod,
      phoneNumber,
      transactionId,
      screenshot,
      bankName,
      accountNumber,
      accountHolderName,
    } = req.body;

    // Validation
    const validPlans = ["bronze", "silver", "gold", "platinum", "custom"];
    if (!selectedPlan || !validPlans.includes(selectedPlan.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan. Must be one of: ${validPlans.join(", ")}`,
      });
    }

    const validCycles = ["monthly", "yearly"];
    if (!billingCycle || !validCycles.includes(billingCycle.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing cycle. Must be 'monthly' or 'yearly'",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (!transactionId || transactionId.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Valid transaction ID is required",
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
      const cleanedPhone = phoneNumber.replace(/\D/g, "");
      const phoneRegex = /^(0?1[3-9]\d{8})$/;
      if (!phoneRegex.test(cleanedPhone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format. Must be 11 digits starting with 01 (e.g., 01712345678)",
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

    const planKey = selectedPlan.toLowerCase();
    const cycleKey = billingCycle.toLowerCase();
    const planConfig = PLAN_CONFIG[planKey];

    if (!planConfig) {
      return res.status(400).json({
        success: false,
        message: "Plan configuration not found",
      });
    }

    // Calculate fee
    const planFee = cycleKey === "yearly" ? planConfig.yearlyFee : planConfig.monthlyFee;

    const planUpgradesCollection = db.collection("plan_upgrades");
    const usersCollection = db.collection("users");
    const userObjectId = new ObjectId(userId);

    // Check if user already has a pending plan upgrade
    const existingPending = await planUpgradesCollection.findOne({
      userId: userObjectId,
      status: "pending",
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending plan upgrade request. Please wait for admin approval or contact support.",
      });
    }

    // Get user details for the record
    const user = await usersCollection.findOne(
      { _id: userObjectId },
      { projection: { fullName: 1, firstName: 1, lastName: 1, email: 1, phone: 1 } }
    );

    // Create plan upgrade request
    const planUpgradeRequest = {
      userId: userObjectId,
      userName: user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Unknown",
      userEmail: user?.email || "",
      userPhone: user?.phone || "",
      selectedPlan: planKey,
      billingCycle: cycleKey,
      planFee,
      paymentMethod,
      phoneNumber: phoneNumber || null,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      accountHolderName: accountHolderName || null,
      transactionId: transactionId.trim(),
      screenshot: screenshot || null,
      status: "pending",
      remarks: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await planUpgradesCollection.insertOne(planUpgradeRequest);

    return res.status(201).json({
      success: true,
      message: "Plan upgrade payment submitted successfully. Admin will review within 24 hours.",
      data: {
        ...planUpgradeRequest,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create plan upgrade request error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit plan upgrade request",
    });
  }
};

// ==================== GET MY PLAN UPGRADES ====================
export const getMyPlanUpgrades = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const planUpgradesCollection = db.collection("plan_upgrades");
    const userObjectId = new ObjectId(userId);

    const planUpgrades = await planUpgradesCollection
      .find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: planUpgrades,
    });
  } catch (error) {
    console.error("Get my plan upgrades error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch plan upgrades",
    });
  }
};

// ==================== GET ALL PLAN UPGRADES (ADMIN) ====================
export const getAllPlanUpgrades = async (req, res) => {
  try {
    const { status = "", page = 1, limit = 20 } = req.query;
    const planUpgradesCollection = db.collection("plan_upgrades");

    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [planUpgrades, total] = await Promise.all([
      planUpgradesCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      planUpgradesCollection.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        planUpgrades,
        pagination: {
          total,
          page: parseInt(page),
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Get all plan upgrades error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch plan upgrades",
    });
  }
};

// ==================== APPROVE PLAN UPGRADE (ADMIN) ====================
export const approvePlanUpgrade = async (req, res) => {
  try {
    const adminId = req.user._id || req.user.id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan upgrade ID",
      });
    }

    const planUpgradesCollection = db.collection("plan_upgrades");
    const usersCollection = db.collection("users");
    const notificationsCollection = db.collection("notifications");

    const planUpgrade = await planUpgradesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!planUpgrade) {
      return res.status(404).json({
        success: false,
        message: "Plan upgrade request not found",
      });
    }

    if (planUpgrade.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${planUpgrade.status}`,
      });
    }

    const planKey = planUpgrade.selectedPlan;
    const cycleKey = planUpgrade.billingCycle;
    const planConfig = PLAN_CONFIG[planKey];

    const planFee = cycleKey === "yearly" ? planConfig.yearlyFee : planConfig.monthlyFee;
    const planExpiry = cycleKey === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updateData = {
      selectedPlan: planKey,
      billingCycle: cycleKey,
      planFee,
      planActive: true,
      planExpiry,
      updatedAt: new Date(),
    };

    if (planKey === "custom") {
      updateData.planFee = 0;
    }

    // Update user plan
    await usersCollection.updateOne(
      { _id: new ObjectId(planUpgrade.userId) },
      { $set: updateData }
    );

    // Update plan upgrade status
    await planUpgradesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "approved",
          approvedBy: new ObjectId(adminId),
          approvedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Create notification for user
    const notification = {
      userId: new ObjectId(planUpgrade.userId),
      title: "🎉 Plan Upgrade Approved!",
      message: `Your plan upgrade to ${planKey.charAt(0).toUpperCase() + planKey.slice(1)} (${cycleKey}) has been approved. Your new plan is now active!`,
      type: "plan_upgrade",
      isRead: false,
      createdAt: new Date(),
    };

    await notificationsCollection.insertOne(notification);

    // Get updated user for token generation
    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(planUpgrade.userId) },
      { projection: { password: 0, pin: 0 } }
    );

    const token = generateToken(updatedUser);

    return res.status(200).json({
      success: true,
      message: `Plan upgrade approved successfully. User is now on ${planKey} (${cycleKey}) plan.`,
      data: {
        planUpgrade: await planUpgradesCollection.findOne({ _id: new ObjectId(id) }),
        token,
      },
    });
  } catch (error) {
    console.error("Approve plan upgrade error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve plan upgrade",
    });
  }
};

// ==================== REJECT PLAN UPGRADE (ADMIN) ====================
export const rejectPlanUpgrade = async (req, res) => {
  try {
    const adminId = req.user._id || req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan upgrade ID",
      });
    }

    const planUpgradesCollection = db.collection("plan_upgrades");
    const notificationsCollection = db.collection("notifications");

    const planUpgrade = await planUpgradesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!planUpgrade) {
      return res.status(404).json({
        success: false,
        message: "Plan upgrade request not found",
      });
    }

    if (planUpgrade.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${planUpgrade.status}`,
      });
    }

    // Update plan upgrade status
    await planUpgradesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "rejected",
          remarks: reason || "No reason provided",
          rejectedBy: new ObjectId(adminId),
          rejectedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Create notification for user
    const notification = {
      userId: new ObjectId(planUpgrade.userId),
      title: "Plan Upgrade Rejected",
      message: `Your plan upgrade request to ${planUpgrade.selectedPlan.charAt(0).toUpperCase() + planUpgrade.selectedPlan.slice(1)} was rejected. Reason: ${reason || "No reason provided"}. Please contact support for more details.`,
      type: "plan_upgrade",
      isRead: false,
      createdAt: new Date(),
    };

    await notificationsCollection.insertOne(notification);

    return res.status(200).json({
      success: true,
      message: "Plan upgrade request rejected successfully",
      data: await planUpgradesCollection.findOne({ _id: new ObjectId(id) }),
    });
  } catch (error) {
    console.error("Reject plan upgrade error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reject plan upgrade",
    });
  }
};
