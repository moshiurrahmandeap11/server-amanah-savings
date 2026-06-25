// controllers/referral/referral.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DEFAULT_REFERRAL_BONUS = 500;
const DEFAULT_REFERRAL_MIN_DEPOSIT = 500;

const getReferralSettings = async () => {
  const settings = await db.collection("platform_settings").findOne({ key: "platform" });
  return {
    bonusAmount: Number(settings?.referrals?.bonusAmount) || DEFAULT_REFERRAL_BONUS,
    minimumDeposit: Number(settings?.referrals?.minimumDeposit) || DEFAULT_REFERRAL_MIN_DEPOSIT,
  };
};

// Generate unique referral code
const generateReferralCode = (name) => {
  const prefix = name?.slice(0, 4).toUpperCase() || "USER";
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${randomNum}`;
};

export const applyReferralBonusForApprovedDeposit = async ({ userId, depositAmount }) => {
  const { bonusAmount: BONUS_AMOUNT, minimumDeposit: MIN_DEPOSIT_FOR_BONUS } = await getReferralSettings();
  const depositAmountNumber = Number(depositAmount) || 0;

  if (!userId || depositAmountNumber < MIN_DEPOSIT_FOR_BONUS) {
    return {
      applied: false,
      reason: "minimum_not_met",
      message: `Minimum deposit of Tk ${MIN_DEPOSIT_FOR_BONUS} required for referral bonus`,
    };
  }

  const referredUserObjectId = new ObjectId(userId);
  const usersCollection = db.collection("users");
  const referralsCollection = db.collection("referrals");
  const depositsCollection = db.collection("deposits");
  const now = new Date();

  const lockPendingReferral = async () => referralsCollection.findOneAndUpdate(
    {
      referredUserId: referredUserObjectId,
      status: "pending",
      bonusPaid: { $ne: true },
    },
    {
      $set: {
        status: "processing",
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  let lockedReferralResult = await lockPendingReferral();

  let referral = lockedReferralResult?.value || lockedReferralResult;

  // Backward-compatibility: older registrations saved referredBy on user but did not create a referrals row.
  // If missing, bootstrap a pending referral and retry locking.
  if (!referral) {
    const referredUser = await usersCollection.findOne(
      { _id: referredUserObjectId },
      { projection: { referredBy: 1, referredByCode: 1 } }
    );

    if (referredUser?.referredBy) {
      const referredByRaw = referredUser.referredBy;
      const referrerObjectId = referredByRaw instanceof ObjectId
        ? referredByRaw
        : (ObjectId.isValid(referredByRaw) ? new ObjectId(referredByRaw) : null);

      if (referrerObjectId) {
        const existingAnyReferral = await referralsCollection.findOne({
          referredUserId: referredUserObjectId,
        });

        if (!existingAnyReferral) {
          await referralsCollection.insertOne({
            referrerId: referrerObjectId,
            referredUserId: referredUserObjectId,
            referralCode: referredUser.referredByCode || null,
            status: "pending",
            bonusPaid: false,
            referrerBonusPaid: false,
            referredBonusPaid: false,
            createdAt: now,
            updatedAt: now,
          });
        }

        lockedReferralResult = await lockPendingReferral();
        referral = lockedReferralResult?.value || lockedReferralResult;
      }
    }
  }

  if (!referral) {
    return {
      applied: false,
      reason: "no_pending_referral",
      message: "No pending referral bonus found for this user",
    };
  }

  try {
    const [referrer, referredUser] = await Promise.all([
      usersCollection.findOne({ _id: referral.referrerId }),
      usersCollection.findOne({ _id: referral.referredUserId }),
    ]);

    if (!referrer || !referredUser) {
      throw new Error("Referral users not found");
    }

    // Add bonus directly to users' totalSaved (no goal created)
    await Promise.all([
      usersCollection.updateOne(
        { _id: referrer._id },
        {
          $inc: {
            totalReferralBonus: BONUS_AMOUNT,
            totalBonusEarned: BONUS_AMOUNT,
            totalSaved: BONUS_AMOUNT, // Direct credit to total savings
          },
          $set: { updatedAt: now },
        }
      ),
      usersCollection.updateOne(
        { _id: referredUser._id },
        {
          $inc: {
            totalReferralBonus: BONUS_AMOUNT,
            totalBonusEarned: BONUS_AMOUNT,
            totalSaved: BONUS_AMOUNT, // Direct credit to total savings
          },
          $set: { updatedAt: now },
        }
      ),
      depositsCollection.insertMany([
        {
          userId: referrer._id,
          depositAmount: BONUS_AMOUNT,
          paymentMethod: "referral",
          transactionReference: `REF_BONUS_${referral._id}_REFERRER`,
          status: "approved",
          isBonus: true,
          bonusType: "referral",
          referredUserId: referredUser._id,
          remarks: `Referral bonus for inviting ${referredUser.fullName || referredUser.firstName}`,
          approvedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: referredUser._id,
          depositAmount: BONUS_AMOUNT,
          paymentMethod: "referral",
          transactionReference: `REF_BONUS_${referral._id}_REFERRED`,
          status: "approved",
          isBonus: true,
          bonusType: "referral",
          referrerId: referrer._id,
          remarks: `Referral bonus for joining via ${referrer.fullName || referrer.firstName}`,
          approvedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ]),
    ]);

    await referralsCollection.updateOne(
      { _id: referral._id },
      {
        $set: {
          status: "completed",
          bonusAmount: BONUS_AMOUNT,
          bonusPaid: true,
          referrerBonusPaid: true,
          referredBonusPaid: true,
          bonusPaidAt: now,
          updatedAt: now,
        },
      }
    );

    return {
      applied: true,
      bonusAmount: BONUS_AMOUNT,
      referrer: referrer.fullName || referrer.firstName,
      referredUser: referredUser.fullName || referredUser.firstName,
      message: `Referral bonus of Tk ${BONUS_AMOUNT} credited to both users' wallets`,
    };
  } catch (error) {
    await referralsCollection.updateOne(
      { _id: referral._id, status: "processing" },
      {
        $set: {
          status: "pending",
          updatedAt: new Date(),
          bonusError: error.message,
        },
      }
    );
    throw error;
  }
};

// Create referral (when user signs up with referral code)
export const createReferral = async (req, res) => {
  try {
    const { referralCode, newUserId } = req.body;
    const normalizedReferralCode = String(referralCode || "").trim().toUpperCase();

    if (!normalizedReferralCode || !newUserId) {
      return res.status(400).json({
        success: false,
        message: "Referral code and new user ID are required",
      });
    }

    const usersCollection = db.collection("users");
    const referralsCollection = db.collection("referrals");

    // Find the referrer user
    const referrer = await usersCollection.findOne({
      referralCode: { $regex: `^${escapeRegex(normalizedReferralCode)}$`, $options: "i" },
    });

    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: "Invalid referral code",
      });
    }

    // Don't allow self-referral
    if (referrer._id.toString() === newUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot refer yourself",
      });
    }

    // Check if user was already referred
    const existingReferral = await referralsCollection.findOne({
      referredUserId: new ObjectId(newUserId),
    });

    if (existingReferral) {
      return res.status(200).json({
        success: true,
        message: "Referral already recorded",
        data: existingReferral,
      });
    }

    // Create referral record
    const referral = {
      referrerId: referrer._id,
      referredUserId: new ObjectId(newUserId),
      referralCode: referrer.referralCode || normalizedReferralCode,
      status: "pending", // pending, active, completed
      bonusPaid: false,
      referrerBonusPaid: false,
      referredBonusPaid: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await referralsCollection.insertOne(referral);

    // Update referrer's referral count
    await usersCollection.updateOne(
      { _id: referrer._id },
      {
        $inc: { totalReferrals: 1 },
        $addToSet: { referredUsers: new ObjectId(newUserId) },
      }
    );

    // Update new user with referrer info
    await usersCollection.updateOne(
      { _id: new ObjectId(newUserId) },
      {
        $set: {
          referredBy: referrer._id,
          referredByCode: referrer.referralCode || normalizedReferralCode,
        },
      }
    );

    return res.status(201).json({
      success: true,
      message: "Referral recorded successfully",
      data: { ...referral, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Create referral error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create referral",
    });
  }
};

// Process referral bonus when referred user makes first deposit
export const processReferralBonus = async (req, res) => {
  try {
    const { userId, depositAmount } = req.body;

    if (!userId || !depositAmount) {
      return res.status(400).json({
        success: false,
        message: "User ID and deposit amount are required",
      });
    }

    const bonusResult = await applyReferralBonusForApprovedDeposit({ userId, depositAmount });

    if (!bonusResult.applied) {
      return res.status(200).json({
        success: true,
        message: bonusResult.message,
        data: bonusResult,
      });
    }

    return res.status(200).json({
      success: true,
      message: bonusResult.message,
      data: bonusResult,
    });

    const usersCollection = db.collection("users");
    const referralsCollection = db.collection("referrals");
    const depositsCollection = db.collection("deposits");
    const goalsCollection = db.collection("goals");

    const BONUS_AMOUNT = 500;
    const MIN_DEPOSIT_FOR_BONUS = 500;

    // Check if deposit meets minimum requirement
    if (depositAmount < MIN_DEPOSIT_FOR_BONUS) {
      return res.status(400).json({
        success: false,
        message: `Minimum deposit of ৳${MIN_DEPOSIT_FOR_BONUS} required for bonus`,
      });
    }

    // Find referral record
    const referral = await referralsCollection.findOne({
      referredUserId: new ObjectId(userId),
      status: "pending",
    });

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: "No pending referral found for this user",
      });
    }

    if (referral.bonusPaid) {
      return res.status(400).json({
        success: false,
        message: "Bonus already paid for this referral",
      });
    }

    // Get referrer and referred user
    const referrer = await usersCollection.findOne({
      _id: referral.referrerId,
    });
    const referredUser = await usersCollection.findOne({
      _id: referral.referredUserId,
    });

    if (!referrer || !referredUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Start a session for transaction
    const session = db.client.startSession();

    try {
      await session.withTransaction(async () => {
        // Update referral status
        await referralsCollection.updateOne(
          { _id: referral._id },
          {
            $set: {
              status: "completed",
              bonusPaid: true,
              referrerBonusPaid: true,
              referredBonusPaid: true,
              bonusPaidAt: new Date(),
              updatedAt: new Date(),
            },
          },
          { session }
        );

        // Add bonus to referrer's goal (create or find a bonus goal)
        let referrerBonusGoal = await goalsCollection.findOne(
          {
            userId: referrer._id,
            goalName: "Referral Bonus",
            status: "active",
          },
          { session }
        );

        if (!referrerBonusGoal) {
          const newGoal = {
            userId: referrer._id,
            goalType: "bonus",
            goalName: "Referral Bonus",
            targetAmount: 100000,
            monthlyDeposit: 0,
            targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            description: "Auto-created for referral bonuses",
            islamicMode: false,
            currentSaved: 0,
            progress: 0,
            status: "active",
            durationInMonths: 12,
            estimatedCompletionDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const result = await goalsCollection.insertOne(newGoal, { session });
          referrerBonusGoal = { ...newGoal, _id: result.insertedId };
        }

        // Update referrer's bonus goal
        const newReferrerSaved = (referrerBonusGoal.currentSaved || 0) + BONUS_AMOUNT;
        await goalsCollection.updateOne(
          { _id: referrerBonusGoal._id },
          {
            $set: {
              currentSaved: newReferrerSaved,
              updatedAt: new Date(),
            },
          },
          { session }
        );

        // Add bonus to referred user's goal
        let referredBonusGoal = await goalsCollection.findOne(
          {
            userId: referredUser._id,
            goalName: "Referral Bonus",
            status: "active",
          },
          { session }
        );

        if (!referredBonusGoal) {
          const newGoal = {
            userId: referredUser._id,
            goalType: "bonus",
            goalName: "Referral Bonus",
            targetAmount: 100000,
            monthlyDeposit: 0,
            targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            description: "Auto-created for referral bonuses",
            islamicMode: false,
            currentSaved: 0,
            progress: 0,
            status: "active",
            durationInMonths: 12,
            estimatedCompletionDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const result = await goalsCollection.insertOne(newGoal, { session });
          referredBonusGoal = { ...newGoal, _id: result.insertedId };
        }

        // Update referred user's bonus goal
        const newReferredSaved = (referredBonusGoal.currentSaved || 0) + BONUS_AMOUNT;
        await goalsCollection.updateOne(
          { _id: referredBonusGoal._id },
          {
            $set: {
              currentSaved: newReferredSaved,
              updatedAt: new Date(),
            },
          },
          { session }
        );

        // Update referrer's total bonus earned
        await usersCollection.updateOne(
          { _id: referrer._id },
          {
            $inc: {
              totalReferralBonus: BONUS_AMOUNT,
              totalBonusEarned: BONUS_AMOUNT,
            },
          },
          { session }
        );

        // Update referred user's total bonus earned
        await usersCollection.updateOne(
          { _id: referredUser._id },
          {
            $inc: {
              totalReferralBonus: BONUS_AMOUNT,
              totalBonusEarned: BONUS_AMOUNT,
            },
          },
          { session }
        );

        // Create bonus deposit records
        const referrerBonusDeposit = {
          userId: referrer._id,
          goalId: referrerBonusGoal._id,
          goalName: "Referral Bonus",
          goalType: "bonus",
          depositAmount: BONUS_AMOUNT,
          paymentMethod: "referral",
          transactionReference: `REF_BONUS_${referral._id}`,
          status: "approved",
          isBonus: true,
          bonusType: "referral",
          referredUserId: referredUser._id,
          remarks: `Referral bonus for inviting ${referredUser.fullName || referredUser.firstName}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const referredBonusDeposit = {
          userId: referredUser._id,
          goalId: referredBonusGoal._id,
          goalName: "Referral Bonus",
          goalType: "bonus",
          depositAmount: BONUS_AMOUNT,
          paymentMethod: "referral",
          transactionReference: `REF_BONUS_${referral._id}`,
          status: "approved",
          isBonus: true,
          bonusType: "referral",
          referrerId: referrer._id,
          remarks: `Referral bonus for joining via ${referrer.fullName || referrer.firstName}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await depositsCollection.insertOne(referrerBonusDeposit, { session });
        await depositsCollection.insertOne(referredBonusDeposit, { session });
      });

      await session.endSession();

      return res.status(200).json({
        success: true,
        message: `Bonus of ৳${BONUS_AMOUNT} credited to both users`,
        data: {
          bonusAmount: BONUS_AMOUNT,
          referrer: referrer.fullName || referrer.firstName,
          referredUser: referredUser.fullName || referredUser.firstName,
        },
      });
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Process referral bonus error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process bonus",
    });
  }
};

// Get user's referral stats
export const getReferralStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const usersCollection = db.collection("users");
    const referralsCollection = db.collection("referrals");

    const referralSettings = await getReferralSettings();
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get referral code (generate if not exists)
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = generateReferralCode(user.fullName || user.firstName);
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { referralCode: referralCode } }
      );
    }

    // Get referral statistics
    const totalReferrals = await referralsCollection.countDocuments({
      referrerId: new ObjectId(userId),
    });

    const activeReferrals = await referralsCollection.countDocuments({
      referrerId: new ObjectId(userId),
      status: "completed",
    });

    const pendingReferrals = await referralsCollection.countDocuments({
      referrerId: new ObjectId(userId),
      status: "pending",
    });

    // Get total bonus earned
    const totalBonus = user.totalReferralBonus || 0;

    // Get this month's bonus
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthBonus = await referralsCollection.aggregate([
      {
        $match: {
          referrerId: new ObjectId(userId),
          bonusPaidAt: { $gte: startOfMonth },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$bonusAmount", referralSettings.bonusAmount] } },
        },
      },
    ]).toArray();

    const frontendUrl = process.env.FRONTEND_URL || "https://sanchoybondhu.com";

    return res.status(200).json({
      success: true,
      data: {
        referralCode,
        referralLink: `${frontendUrl.replace(/\/$/, "")}/register?ref=${encodeURIComponent(referralCode)}`,
        stats: {
          totalReferrals,
          activeReferrals,
          pendingReferrals,
          totalBonusEarned: totalBonus,
          thisMonthBonus: thisMonthBonus[0]?.total || 0,
          bonusAmount: referralSettings.bonusAmount,
          minimumDeposit: referralSettings.minimumDeposit,
        },
      },
    });
  } catch (error) {
    console.error("Get referral stats error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch referral stats",
    });
  }
};

// Get user's referral history
export const getReferralHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const referralsCollection = db.collection("referrals");
    const usersCollection = db.collection("users");
    const referralSettings = await getReferralSettings();

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const referrals = await referralsCollection
      .aggregate([
        { $match: { referrerId: new ObjectId(userId) } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "users",
            localField: "referredUserId",
            foreignField: "_id",
            as: "referredUser",
          },
        },
        {
          $unwind: {
            path: "$referredUser",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            status: 1,
            bonusPaid: 1,
            createdAt: 1,
            bonusPaidAt: 1,
            bonusAmount: 1,
            "referredUser.fullName": 1,
            "referredUser.firstName": 1,
            "referredUser.createdAt": 1,
          },
        },
      ])
      .toArray();

    const total = await referralsCollection.countDocuments({
      referrerId: new ObjectId(userId),
    });

    // Format referral history
    const history = referrals.map((ref) => {
      const referredName = ref.referredUser?.fullName || ref.referredUser?.firstName || "Someone";
      const joinedDate = ref.referredUser?.createdAt;
      const depositDate = ref.bonusPaidAt;
      const bonusAmount = Number(ref.bonusAmount) || referralSettings.bonusAmount;
      const displayBonus = `৳${bonusAmount.toLocaleString("en-BD")}`;

      let status = "pending";
      let badge = "Waiting for deposit";
      let amount = "৳500";
      let amountColor = "text-foreground/50";
      amount = displayBonus;

      if (ref.status === "completed" && ref.bonusPaid) {
        status = "bonus";
        badge = "Bonus Deposited";
        amount = "+৳500";
        amountColor = "text-primary";
        amount = `+${displayBonus}`;
      } else if (ref.status === "pending") {
        status = "pending";
        badge = "Pending";
        amount = "৳500";
        amountColor = "text-foreground/50";
        amount = displayBonus;
      }

      return {
        id: ref._id,
        name: `${referredName} joined`,
        date: joinedDate
          ? `${new Date(joinedDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })} · ${ref.status === "completed" ? "First deposit made" : "Waiting for deposit"}`
          : "Recently joined",
        amount,
        amountColor,
        status,
        badge,
        completedAt: depositDate,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get referral history error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch referral history",
    });
  }
};

// Get leaderboard of top referrers
export const getReferralLeaderboard = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const usersCollection = db.collection("users");

    const leaderboard = await usersCollection
      .find(
        { totalReferrals: { $gt: 0 } },
        {
          projection: {
            fullName: 1,
            firstName: 1,
            profilePicture: 1,
            totalReferrals: 1,
            totalReferralBonus: 1,
          },
        }
      )
      .sort({ totalReferrals: -1, totalReferralBonus: -1 })
      .limit(parseInt(limit))
      .toArray();

    const formattedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      rankIcon: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`,
      name: user.fullName || user.firstName || "Anonymous",
      profilePicture: user.profilePicture,
      referrals: user.totalReferrals || 0,
      bonusEarned: user.totalReferralBonus || 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        total: leaderboard.length,
      },
    });
  } catch (error) {
    console.error("Get referral leaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch leaderboard",
    });
  }
};

// Get user's referred users details
export const getReferredUsers = async (req, res) => {
  try {
    const userId = req.user._id;

    const usersCollection = db.collection("users");
    const referralsCollection = db.collection("referrals");
    const depositsCollection = db.collection("deposits");

    const referrals = await referralsCollection
      .find({
        referrerId: new ObjectId(userId),
        status: "completed",
      })
      .toArray();

    const referredUserIds = referrals.map((r) => r.referredUserId);

    const referredUsers = await usersCollection
      .find({ _id: { $in: referredUserIds } })
      .toArray();

    // Get first deposit details for each referred user
    const usersWithDeposits = await Promise.all(
      referredUsers.map(async (user) => {
        const firstDeposit = await depositsCollection.findOne({
          userId: user._id,
          status: "approved",
        });

        return {
          id: user._id,
          name: user.fullName || user.firstName,
          email: user.email,
          phone: user.phone,
          joinedAt: user.createdAt,
          firstDepositAmount: firstDeposit?.depositAmount || 0,
          firstDepositDate: firstDeposit?.createdAt || null,
          totalSaved: user.totalSaved || 0,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: usersWithDeposits,
    });
  } catch (error) {
    console.error("Get referred users error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch referred users",
    });
  }
};

// Admin: Get all referrals
export const getAllReferrals = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const referralsCollection = db.collection("referrals");

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const referrals = await referralsCollection
      .aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "users",
            localField: "referrerId",
            foreignField: "_id",
            as: "referrer",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "referredUserId",
            foreignField: "_id",
            as: "referredUser",
          },
        },
        {
          $project: {
            _id: 1,
            status: 1,
            bonusPaid: 1,
            createdAt: 1,
            bonusPaidAt: 1,
            "referrer.fullName": 1,
            "referrer.email": 1,
            "referrer.phone": 1,
            "referredUser.fullName": 1,
            "referredUser.email": 1,
            "referredUser.phone": 1,
          },
        },
      ])
      .toArray();

    const total = await referralsCollection.countDocuments(query);

    // Get statistics
    const statistics = await referralsCollection.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          bonusPaidCount: { $sum: { $cond: ["$bonusPaid", 1, 0] } },
        },
      },
    ]).toArray();

    const stats = {
      pending: statistics.find(s => s._id === "pending") || { count: 0, bonusPaidCount: 0 },
      completed: statistics.find(s => s._id === "completed") || { count: 0, bonusPaidCount: 0 },
      total: total,
    };

    return res.status(200).json({
      success: true,
      data: {
        referrals,
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
    console.error("Get all referrals error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch referrals",
    });
  }
};
