// controllers/challenge/challenge.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Create a new challenge
export const createChallenge = async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      bgGradient,
      period,
      startDate,
      endDate,
      days,
      maxReward,
      reward,
      targetAmount,
      dailyTarget,
    } = req.body;

    // Validation
    if (!name || !description || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const challengesCollection = db.collection("challenges");

    const newChallenge = {
      name,
      description,
      icon: icon || "🏆",
      bgGradient: bgGradient || "from-primary to-primary-light",
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days: days || Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)),
      maxReward: maxReward || "Special",
      reward: reward || "🏆 Completion Badge",
      targetAmount: targetAmount || 0,
      dailyTarget: dailyTarget || 0,
      status: new Date(startDate) <= new Date() ? "active" : "upcoming",
      participants: 0,
      totalSaved: 0,
      completedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await challengesCollection.insertOne(newChallenge);

    return res.status(201).json({
      success: true,
      message: "Challenge created successfully",
      data: { ...newChallenge, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Create challenge error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create challenge",
    });
  }
};

// Get all challenges
export const getAllChallenges = async (req, res) => {
  try {
    const { status } = req.query;
    const challengesCollection = db.collection("challenges");
    
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const challenges = await challengesCollection
      .find(query)
      .sort({ startDate: 1 })
      .toArray();

    // Get participant counts and progress for each challenge
    const userChallengesCollection = db.collection("user_challenges");
    
    const challengesWithStats = await Promise.all(
      challenges.map(async (challenge) => {
        const participantCount = await userChallengesCollection.countDocuments({
          challengeId: challenge._id,
          status: { $in: ["active", "completed"] }
        });
        
        const completedCount = await userChallengesCollection.countDocuments({
          challengeId: challenge._id,
          status: "completed"
        });
        
        const totalSaved = await userChallengesCollection.aggregate([
          { $match: { challengeId: challenge._id, status: "completed" } },
          { $group: { _id: null, total: { $sum: "$totalSaved" } } }
        ]).toArray();
        
        return {
          ...challenge,
          participants: participantCount,
          completedCount,
          totalSaved: totalSaved[0]?.total || 0,
        };
      })
    );

    // Get statistics
    const activeChallenges = challengesWithStats.filter(c => c.status === "active").length;
    const totalParticipants = challengesWithStats.reduce((sum, c) => sum + c.participants, 0);
    const totalSavedAll = challengesWithStats.reduce((sum, c) => sum + c.totalSaved, 0);

    return res.status(200).json({
      success: true,
      data: {
        challenges: challengesWithStats,
        statistics: {
          totalChallenges: challenges.length,
          activeChallenges,
          totalParticipants,
          totalSaved: `৳${totalSavedAll.toLocaleString()}`,
        },
      },
    });
  } catch (error) {
    console.error("Get all challenges error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch challenges",
    });
  }
};

// Get single challenge by ID
export const getChallengeById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid challenge ID",
      });
    }

    const challengesCollection = db.collection("challenges");
    const challenge = await challengesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: "Challenge not found",
      });
    }

    // Get user's participation if logged in
    let userParticipation = null;
    if (userId) {
      const userChallengesCollection = db.collection("user_challenges");
      userParticipation = await userChallengesCollection.findOne({
        userId: new ObjectId(userId),
        challengeId: new ObjectId(id),
      });
    }

    // Get leaderboard for this challenge
    const userChallengesCollection = db.collection("user_challenges");
    const leaderboard = await userChallengesCollection.aggregate([
      { $match: { challengeId: new ObjectId(id), status: "active" } },
      { $sort: { currentSaved: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $project: {
          currentSaved: 1,
          progress: 1,
          daysCompleted: 1,
          "user.fullName": 1,
          "user.firstName": 1,
          "user.profilePicture": 1,
        },
      },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        challenge,
        userParticipation,
        leaderboard,
      },
    });
  } catch (error) {
    console.error("Get challenge by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch challenge",
    });
  }
};

// Join a challenge
export const joinChallenge = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid challenge ID",
      });
    }

    const challengesCollection = db.collection("challenges");
    const userChallengesCollection = db.collection("user_challenges");
    const usersCollection = db.collection("users");

    // Check if challenge exists and is active
    const challenge = await challengesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: "Challenge not found",
      });
    }

    if (challenge.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Challenge is not active",
      });
    }

    // Check if user already joined
    const existingParticipation = await userChallengesCollection.findOne({
      userId: new ObjectId(userId),
      challengeId: new ObjectId(id),
    });

    if (existingParticipation) {
      return res.status(400).json({
        success: false,
        message: "You have already joined this challenge",
      });
    }

    // Get user's current savings
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    // Create participation record
    const participation = {
      userId: new ObjectId(userId),
      challengeId: new ObjectId(id),
      challengeName: challenge.name,
      joinedAt: new Date(),
      status: "active",
      currentSaved: 0,
      targetAmount: challenge.targetAmount,
      dailyTarget: challenge.dailyTarget,
      progress: 0,
      daysCompleted: 0,
      lastSavedDate: null,
      streak: 0,
      completedAt: null,
      rewards: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await userChallengesCollection.insertOne(participation);

    // Update challenge participant count
    await challengesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { participants: 1 } }
    );

    return res.status(200).json({
      success: true,
      message: `Successfully joined ${challenge.name}`,
      data: participation,
    });
  } catch (error) {
    console.error("Join challenge error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to join challenge",
    });
  }
};

// Update challenge progress (when user makes a deposit)
export const updateChallengeProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const userChallengesCollection = db.collection("user_challenges");
    const challengesCollection = db.collection("challenges");
    const depositsCollection = db.collection("deposits");

    // Get user's participation
    const participation = await userChallengesCollection.findOne({
      userId: new ObjectId(userId),
      challengeId: new ObjectId(id),
      status: "active",
    });

    if (!participation) {
      return res.status(404).json({
        success: false,
        message: "You haven't joined this challenge",
      });
    }

    const challenge = await challengesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: "Challenge not found",
      });
    }

    // Check if user has made a deposit today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayDeposit = await depositsCollection.findOne({
      userId: new ObjectId(userId),
      createdAt: { $gte: today },
      status: "approved",
    });

    const newCurrentSaved = participation.currentSaved + amount;
    const newProgress = Math.min(
      Math.round((newCurrentSaved / (challenge.targetAmount || newCurrentSaved)) * 100),
      100
    );
    
    let newDaysCompleted = participation.daysCompleted;
    let newStreak = participation.streak;
    
    // Update streak if this is today's first deposit
    if (todayDeposit) {
      const lastSavedDate = participation.lastSavedDate;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (!lastSavedDate || new Date(lastSavedDate) < yesterday) {
        newStreak = 1;
      } else if (new Date(lastSavedDate).toDateString() === yesterday.toDateString()) {
        newStreak = participation.streak + 1;
      }
      
      newDaysCompleted = participation.daysCompleted + 1;
    }

    const updateData = {
      currentSaved: newCurrentSaved,
      progress: newProgress,
      daysCompleted: newDaysCompleted,
      streak: newStreak,
      lastSavedDate: new Date(),
      updatedAt: new Date(),
    };

    // Check if challenge is completed
    let isCompleted = false;
    if (newProgress >= 100 || newDaysCompleted >= challenge.days) {
      updateData.status = "completed";
      updateData.completedAt = new Date();
      isCompleted = true;
      
      // Award bonus for completion
      updateData.rewards = [
        ...participation.rewards,
        {
          type: "completion",
          name: "Challenge Completed",
          awardedAt: new Date(),
        },
      ];
      
      // Update challenge completed count
      await challengesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { completedCount: 1, totalSaved: amount } }
      );
    } else {
      await challengesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { totalSaved: amount } }
      );
    }

    await userChallengesCollection.updateOne(
      { _id: participation._id },
      { $set: updateData }
    );

    return res.status(200).json({
      success: true,
      message: isCompleted ? "🎉 Challenge completed! 🎉" : "Progress updated",
      data: {
        currentSaved: newCurrentSaved,
        progress: newProgress,
        daysCompleted: newDaysCompleted,
        streak: newStreak,
        completed: isCompleted,
      },
    });
  } catch (error) {
    console.error("Update challenge progress error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update progress",
    });
  }
};

// Get user's active challenges
export const getUserChallenges = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const userChallengesCollection = db.collection("user_challenges");
    const challengesCollection = db.collection("challenges");

    const query = { userId: new ObjectId(userId) };
    if (status && status !== "all") {
      query.status = status;
    }

    const userChallenges = await userChallengesCollection
      .find(query)
      .sort({ joinedAt: -1 })
      .toArray();

    // Get challenge details
    const challengesWithDetails = await Promise.all(
      userChallenges.map(async (uc) => {
        const challenge = await challengesCollection.findOne({
          _id: uc.challengeId,
        });
        return {
          ...uc,
          challengeDetails: challenge,
        };
      })
    );

    // Calculate statistics
    const activeCount = userChallenges.filter(uc => uc.status === "active").length;
    const completedCount = userChallenges.filter(uc => uc.status === "completed").length;
    const totalSaved = userChallenges.reduce((sum, uc) => sum + (uc.currentSaved || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        challenges: challengesWithDetails,
        statistics: {
          activeCount,
          completedCount,
          totalSaved: `৳${totalSaved.toLocaleString()}`,
          totalJoined: userChallenges.length,
        },
      },
    });
  } catch (error) {
    console.error("Get user challenges error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user challenges",
    });
  }
};

// Get challenge leaderboard
export const getChallengeLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid challenge ID",
      });
    }

    const userChallengesCollection = db.collection("user_challenges");

    const leaderboard = await userChallengesCollection.aggregate([
      { $match: { challengeId: new ObjectId(id), status: "active" } },
      { $sort: { currentSaved: -1, daysCompleted: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $project: {
          currentSaved: 1,
          progress: 1,
          daysCompleted: 1,
          streak: 1,
          "user.fullName": 1,
          "user.firstName": 1,
          "user.profilePicture": 1,
        },
      },
    ]).toArray();

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      rankIcon: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`,
      name: entry.user?.[0]?.fullName || entry.user?.[0]?.firstName || "Anonymous",
      profilePicture: entry.user?.[0]?.profilePicture,
      saved: `৳${entry.currentSaved.toLocaleString()}`,
      progress: entry.progress,
      daysCompleted: entry.daysCompleted,
      streak: entry.streak,
    }));

    return res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        totalParticipants: leaderboard.length,
      },
    });
  } catch (error) {
    console.error("Get challenge leaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch leaderboard",
    });
  }
};

// Admin: Update challenge status
export const updateChallengeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid challenge ID",
      });
    }

    if (!["active", "upcoming", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const challengesCollection = db.collection("challenges");

    const result = await challengesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Challenge not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Challenge status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update challenge status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update challenge status",
    });
  }
};

// Get challenge statistics for admin
export const getChallengeStatistics = async (req, res) => {
  try {
    const challengesCollection = db.collection("challenges");
    const userChallengesCollection = db.collection("user_challenges");

    const totalChallenges = await challengesCollection.countDocuments();
    const activeChallenges = await challengesCollection.countDocuments({ status: "active" });
    const upcomingChallenges = await challengesCollection.countDocuments({ status: "upcoming" });
    const completedChallenges = await challengesCollection.countDocuments({ status: "completed" });

    const totalParticipants = await userChallengesCollection.countDocuments();
    const activeParticipants = await userChallengesCollection.countDocuments({ status: "active" });
    const completedParticipants = await userChallengesCollection.countDocuments({ status: "completed" });

    const totalSaved = await userChallengesCollection.aggregate([
      { $group: { _id: null, total: { $sum: "$currentSaved" } } }
    ]).toArray();

    const mostPopularChallenge = await userChallengesCollection.aggregate([
      { $group: { _id: "$challengeId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "challenges",
          localField: "_id",
          foreignField: "_id",
          as: "challenge",
        },
      },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        challenges: {
          total: totalChallenges,
          active: activeChallenges,
          upcoming: upcomingChallenges,
          completed: completedChallenges,
        },
        participants: {
          total: totalParticipants,
          active: activeParticipants,
          completed: completedParticipants,
        },
        totalSaved: `৳${(totalSaved[0]?.total || 0).toLocaleString()}`,
        mostPopular: mostPopularChallenge[0]?.challenge[0]?.name || "N/A",
      },
    });
  } catch (error) {
    console.error("Get challenge statistics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch statistics",
    });
  }
};