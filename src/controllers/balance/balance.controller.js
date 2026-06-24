// controllers/balance/balance.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Get user's balance summary (Total Balance, Total Withdrawal, Referral Bonus)
export const getUserBalanceSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");
    const withdrawalsCollection = db.collection("withdrawals");
    const referralsCollection = db.collection("referrals");

    const userObjectId = new ObjectId(userId);

    // Get user data
    const user = await usersCollection.findOne(
      { _id: userObjectId },
      {
        projection: {
          totalSaved: 1,
          totalReferralBonus: 1,
          totalBonusEarned: 1,
          totalDeposits: 1,
          totalWithdrawals: 1,
        },
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate total deposits (approved deposits only, excluding bonuses)
    const depositStats = await depositsCollection
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: "approved",
            isBonus: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            totalDeposits: { $sum: "$depositAmount" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Calculate total withdrawals (completed withdrawals)
    const withdrawalStats = await withdrawalsCollection
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: { $in: ["approved", "completed"] },
          },
        },
        {
          $group: {
            _id: null,
            totalWithdrawn: { $sum: "$withdrawalAmount" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Calculate total referral bonus earned
    const referralBonusStats = await referralsCollection
      .aggregate([
        {
          $match: {
            $or: [
              { referrerId: userObjectId, referrerBonusPaid: true },
              { referredUserId: userObjectId, referredBonusPaid: true },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalReferralBonus: {
              $sum: {
                $cond: [
                  { $eq: ["$referrerId", userObjectId] },
                  { $ifNull: ["$bonusAmount", 500] },
                  { $ifNull: ["$bonusAmount", 500] },
                ],
              },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Calculate referral bonus withdrawn
    const referralBonusWithdrawn = await withdrawalsCollection
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: { $in: ["approved", "completed"] },
            isReferralBonus: true,
          },
        },
        {
          $group: {
            _id: null,
            totalWithdrawn: { $sum: "$withdrawalAmount" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Calculate pending referral bonus withdrawals
    const pendingReferralBonusWithdrawals = await withdrawalsCollection
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: "pending",
            isReferralBonus: true,
          },
        },
        {
          $group: {
            _id: null,
            totalPending: { $sum: "$withdrawalAmount" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const totalDeposits = depositStats[0]?.totalDeposits || 0;
    const totalWithdrawn = withdrawalStats[0]?.totalWithdrawn || 0;
    const totalReferralBonusEarned = referralBonusStats[0]?.totalReferralBonus || 0;
    const totalReferralBonusWithdrawn = referralBonusWithdrawn[0]?.totalWithdrawn || 0;
    const pendingReferralBonusAmount = pendingReferralBonusWithdrawals[0]?.totalPending || 0;

    // Available referral bonus = earned - withdrawn - pending
    const availableReferralBonus = Math.max(
      0,
      totalReferralBonusEarned -
        totalReferralBonusWithdrawn -
        pendingReferralBonusAmount
    );

    // Net balance = total deposits - total withdrawn
    const netBalance = Math.max(0, totalDeposits - totalWithdrawn);

    return res.status(200).json({
      success: true,
      data: {
        // 1. Total Balance (all approved deposits minus all approved/completed withdrawals)
        totalBalance: {
          amount: netBalance,
          totalDeposits,
          totalWithdrawn,
        },
        // 2. Total Withdrawal (all completed/approved withdrawals)
        totalWithdrawal: {
          amount: totalWithdrawn,
          count: withdrawalStats[0]?.count || 0,
        },
        // 3. Referral Bonus
        referralBonus: {
          earned: totalReferralBonusEarned,
          withdrawn: totalReferralBonusWithdrawn,
          pendingWithdrawals: pendingReferralBonusWithdrawals,
          available: availableReferralBonus,
          count: referralBonusStats[0]?.count || 0,
        },
        // Raw user data for reference
        userStats: {
          totalSaved: user.totalSaved || 0,
          totalReferralBonus: user.totalReferralBonus || 0,
          totalBonusEarned: user.totalBonusEarned || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get user balance summary error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch balance summary",
    });
  }
};

// Create referral bonus withdrawal request
export const createReferralBonusWithdrawal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { withdrawalAmount, reason, paymentMethod, phoneNumber, bankName, accountNumber, accountHolderName } = req.body;

    // Validation
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
      // Accepts: 01712345678, 1712345678, 01609836406, 1609836406 etc.
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      const phoneRegex = /^(0?1[3-9]\d{8})$/;
      if (!phoneRegex.test(cleanedPhone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format. Must be 11 digits starting with 01 or 1 (e.g., 01712345678 or 1712345678)",
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
    const withdrawalsCollection = db.collection("withdrawals");
    const referralsCollection = db.collection("referrals");
    const userObjectId = new ObjectId(userId);

    // Check if user exists
    const user = await usersCollection.findOne({ _id: userObjectId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate available referral bonus
    const referralBonusStats = await referralsCollection
      .aggregate([
        {
          $match: {
            $or: [
              { referrerId: userObjectId, referrerBonusPaid: true },
              { referredUserId: userObjectId, referredBonusPaid: true },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalReferralBonus: {
              $sum: { $ifNull: ["$bonusAmount", 500] },
            },
          },
        },
      ])
      .toArray();

    const totalReferralBonusEarned = referralBonusStats[0]?.totalReferralBonus || 0;

    // Calculate already withdrawn referral bonus
    const withdrawnStats = await withdrawalsCollection
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: { $in: ["approved", "completed"] },
            isReferralBonus: true,
          },
        },
        {
          $group: {
            _id: null,
            totalWithdrawn: { $sum: "$withdrawalAmount" },
          },
        },
      ])
      .toArray();

    const totalReferralBonusWithdrawn = withdrawnStats[0]?.totalWithdrawn || 0;

    // Calculate pending referral bonus withdrawals
    const pendingStats = await withdrawalsCollection
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: "pending",
            isReferralBonus: true,
          },
        },
        {
          $group: {
            _id: null,
            totalPending: { $sum: "$withdrawalAmount" },
          },
        },
      ])
      .toArray();

    const pendingReferralBonusWithdrawals = pendingStats[0]?.totalPending || 0;

    const availableReferralBonus = Math.max(
      0,
      totalReferralBonusEarned - totalReferralBonusWithdrawn - pendingReferralBonusAmount
    );

    const withdrawalAmountNum = parseFloat(withdrawalAmount);

    // Check if user has enough referral bonus
    if (withdrawalAmountNum > availableReferralBonus) {
      return res.status(400).json({
        success: false,
        message: `Insufficient referral bonus. Available: ৳${availableReferralBonus.toLocaleString()}, Requested: ৳${withdrawalAmountNum.toLocaleString()}`,
      });
    }

    // Check for pending referral bonus withdrawal
    const existingPending = await withdrawalsCollection.findOne({
      userId: userObjectId,
      status: "pending",
      isReferralBonus: true,
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending referral bonus withdrawal request",
      });
    }

    // Create withdrawal object
    const newWithdrawal = {
      userId: userObjectId,
      goalId: null, // No goal for referral bonus withdrawal
      goalName: "Referral Bonus",
      goalType: "referral_bonus",
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
      status: "pending",
      remarks: null,
      approvedBy: null,
      approvedAt: null,
      processedAt: null,
      isReferralBonus: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await withdrawalsCollection.insertOne(newWithdrawal);
    const withdrawal = { ...newWithdrawal, _id: result.insertedId };

    return res.status(201).json({
      success: true,
      message: "Referral bonus withdrawal request submitted successfully. Admin will review within 5-7 working days.",
      data: {
        withdrawal,
        availableReferralBonus: availableReferralBonus - withdrawalAmountNum,
      },
    });
  } catch (error) {
    console.error("Create referral bonus withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit referral bonus withdrawal request",
    });
  }
};

// Transfer referral bonus to a savings goal
export const transferReferralBonusToGoal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, goalId } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    if (!goalId) {
      return res.status(400).json({
        success: false,
        message: "Goal ID is required",
      });
    }

    const usersCollection = db.collection("users");
    const goalsCollection = db.collection("goals");
    const depositsCollection = db.collection("deposits");
    const notificationsCollection = db.collection("notifications");
    const userObjectId = new ObjectId(userId);

    // Check if user exists
    const user = await usersCollection.findOne({ _id: userObjectId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if goal exists and belongs to user
    const goalObjectId = new ObjectId(goalId);
    const goal = await goalsCollection.findOne({
      _id: goalObjectId,
      userId: userObjectId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found or does not belong to you",
      });
    }

    if (goal.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot add bonus to a completed goal",
      });
    }

    const transferAmount = parseFloat(amount);

    // Calculate available referral bonus (same logic as getUserBalanceSummary)
    const referralsCollection = db.collection("referrals");
    const withdrawalsCollection = db.collection("withdrawals");

    const referralBonusStats = await referralsCollection
      .aggregate([
        {
          $match: {
            $or: [
              { referrerId: userObjectId, referrerBonusPaid: true },
              { referredUserId: userObjectId, referredBonusPaid: true },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalReferralBonus: { $sum: { $ifNull: ["$bonusAmount", 500] } },
          },
        },
      ])
      .toArray();

    const withdrawnStats = await withdrawalsCollection
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: { $in: ["approved", "completed"] },
            isReferralBonus: true,
          },
        },
        {
          $group: {
            _id: null,
            totalWithdrawn: { $sum: "$withdrawalAmount" },
          },
        },
      ])
      .toArray();

    const pendingStats = await withdrawalsCollection
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: "pending",
            isReferralBonus: true,
          },
        },
        {
          $group: {
            _id: null,
            totalPending: { $sum: "$withdrawalAmount" },
          },
        },
      ])
      .toArray();

    const totalReferralBonusEarned = referralBonusStats[0]?.totalReferralBonus || 0;
    const totalReferralBonusWithdrawn = withdrawnStats[0]?.totalWithdrawn || 0;
    const pendingReferralBonusWithdrawals = pendingStats[0]?.totalPending || 0;

    const availableReferralBonus = Math.max(
      0,
      totalReferralBonusEarned - totalReferralBonusWithdrawn - pendingReferralBonusWithdrawals
    );

    // Check if user has enough referral bonus
    if (transferAmount > availableReferralBonus) {
      return res.status(400).json({
        success: false,
        message: `Insufficient referral bonus. Available: ৳${availableReferralBonus.toLocaleString()}, Requested: ৳${transferAmount.toLocaleString()}`,
      });
    }

    // Calculate new goal values
    const newCurrentSaved = (goal.currentSaved || 0) + transferAmount;
    const newProgress = Math.min(
      100,
      Math.round((newCurrentSaved / goal.targetAmount) * 100)
    );
    const isGoalCompleted = newCurrentSaved >= goal.targetAmount;

    // Update goal
    await goalsCollection.updateOne(
      { _id: goalObjectId },
      {
        $set: {
          currentSaved: newCurrentSaved,
          progress: newProgress,
          status: isGoalCompleted ? "completed" : "active",
          updatedAt: new Date(),
        },
      }
    );

    // Create deposit record for this transfer (for tracking)
    const depositRecord = {
      userId: userObjectId,
      goalId: goalObjectId,
      goalName: goal.goalName,
      depositAmount: transferAmount,
      paymentMethod: "referral_bonus",
      status: "approved",
      isBonus: true,
      bonusType: "referral",
      notes: "Referral bonus transferred to goal",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await depositsCollection.insertOne(depositRecord);

    // Update user's total referral bonus (track transferred amount)
    const totalTransferredToGoals = user.totalReferralBonusTransferredToGoals || 0;
    await usersCollection.updateOne(
      { _id: userObjectId },
      {
        $set: {
          totalReferralBonusTransferredToGoals: totalTransferredToGoals + transferAmount,
          updatedAt: new Date(),
        },
      }
    );

    // Create notification
    const notification = {
      userId: userObjectId,
      title: "Referral Bonus Added to Goal",
      message: `৳${transferAmount.toLocaleString()} referral bonus has been added to your "${goal.goalName}" goal.`,
      type: "bonus",
      isRead: false,
      createdAt: new Date(),
    };

    await notificationsCollection.insertOne(notification);

    // Goal completion notification if applicable
    if (isGoalCompleted && goal.status !== "completed") {
      const completionNotification = {
        userId: userObjectId,
        title: "🎉 Goal Completed!",
        message: `Congratulations! Your "${goal.goalName}" goal has been completed with a referral bonus boost!`,
        type: "goal",
        isRead: false,
        createdAt: new Date(),
      };
      await notificationsCollection.insertOne(completionNotification);
    }

    return res.status(200).json({
      success: true,
      message: `৳${transferAmount.toLocaleString()} referral bonus transferred to "${goal.goalName}" successfully`,
      data: {
        amount: transferAmount,
        goalName: goal.goalName,
        newCurrentSaved,
        newProgress,
        goalCompleted: isGoalCompleted,
      },
    });
  } catch (error) {
    console.error("Transfer referral bonus to goal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to transfer referral bonus to goal",
    });
  }
};
