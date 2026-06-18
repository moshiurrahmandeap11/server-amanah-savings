// controllers/achievement/achievement.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Define badge configurations
const BADGE_CONFIGS = {
  // Streak Badges
  streak_7: {
    name: "7-Day Warrior",
    emoji: "🔥",
    description: "7 consecutive days of saving",
    requirement: "7 days streak",
    category: "streak",
    points: 50,
    level: 1,
  },
  streak_30: {
    name: "Monthly Master",
    emoji: "⭐",
    description: "30 consecutive days of saving",
    requirement: "30 days streak",
    category: "streak",
    points: 200,
    level: 2,
  },
  streak_90: {
    name: "90-Day Streak",
    emoji: "🏆",
    description: "90 consecutive days of saving",
    requirement: "90 days streak",
    category: "streak",
    points: 500,
    level: 3,
  },
  streak_180: {
    name: "Half Year Hero",
    emoji: "💪",
    description: "180 consecutive days of saving",
    requirement: "180 days streak",
    category: "streak",
    points: 1000,
    level: 4,
  },
  streak_365: {
    name: "Year Long Legend",
    emoji: "👑",
    description: "365 consecutive days of saving",
    requirement: "365 days streak",
    category: "streak",
    points: 2500,
    level: 5,
  },

  // Savings Badges
  savings_1000: {
    name: "Starter Saver",
    emoji: "🌱",
    description: "Total savings reached ৳1,000",
    requirement: "৳1,000 total savings",
    category: "savings",
    points: 25,
    level: 1,
  },
  savings_10000: {
    name: "Bronze Saver",
    emoji: "🥉",
    description: "Total savings reached ৳10,000",
    requirement: "৳10,000 total savings",
    category: "savings",
    points: 100,
    level: 2,
  },
  savings_50000: {
    name: "Silver Saver",
    emoji: "🥈",
    description: "Total savings reached ৳50,000",
    requirement: "৳50,000 total savings",
    category: "savings",
    points: 250,
    level: 3,
  },
  savings_200000: {
    name: "Gold Saver",
    emoji: "🥇",
    description: "Total savings reached ৳2,00,000",
    requirement: "৳2,00,000 total savings",
    category: "savings",
    points: 500,
    level: 4,
  },
  savings_500000: {
    name: "Platinum Saver",
    emoji: "💎",
    description: "Total savings reached ৳5,00,000",
    requirement: "৳5,00,000 total savings",
    category: "savings",
    points: 1000,
    level: 5,
  },
  savings_1000000: {
    name: "Diamond Saver",
    emoji: "💍",
    description: "Total savings reached ৳10,00,000",
    requirement: "৳10,00,000 total savings",
    category: "savings",
    points: 2500,
    level: 6,
  },

  // Goal Badges
  goal_complete_1: {
    name: "Goal Getter",
    emoji: "🎯",
    description: "Completed your first goal",
    requirement: "Complete 1 goal",
    category: "goal",
    points: 100,
    level: 1,
  },
  goal_complete_3: {
    name: "Goal Master",
    emoji: "🏆",
    description: "Completed 3 goals",
    requirement: "Complete 3 goals",
    category: "goal",
    points: 300,
    level: 2,
  },
  goal_complete_5: {
    name: "Goal Legend",
    emoji: "👑",
    description: "Completed 5 goals",
    requirement: "Complete 5 goals",
    category: "goal",
    points: 500,
    level: 3,
  },

  // Referral Badges
  referral_1: {
    name: "Community Builder",
    emoji: "🤝",
    description: "Referred 1 friend",
    requirement: "1 successful referral",
    category: "referral",
    points: 50,
    level: 1,
  },
  referral_5: {
    name: "Referral Hero",
    emoji: "🌟",
    description: "Referred 5 friends",
    requirement: "5 successful referrals",
    category: "referral",
    points: 250,
    level: 2,
  },
  referral_10: {
    name: "Community Champion",
    emoji: "🎖️",
    description: "Referred 10 friends",
    requirement: "10 successful referrals",
    category: "referral",
    points: 500,
    level: 3,
  },
  referral_25: {
    name: "Super Connector",
    emoji: "💫",
    description: "Referred 25 friends",
    requirement: "25 successful referrals",
    category: "referral",
    points: 1000,
    level: 4,
  },

  // Challenge Badges
  challenge_ramadan: {
    name: "Ramadan Saver",
    emoji: "🌙",
    description: "Completed the Ramadan Challenge",
    requirement: "Complete Ramadan challenge",
    category: "challenge",
    points: 200,
    level: 1,
  },
  challenge_eid: {
    name: "Eid Mubarak",
    emoji: "🎉",
    description: "Completed the Eid Challenge",
    requirement: "Complete Eid challenge",
    category: "challenge",
    points: 200,
    level: 1,
  },
  challenge_100day: {
    name: "Century Club",
    emoji: "💯",
    description: "Completed the 100-Day Challenge",
    requirement: "Complete 100-day challenge",
    category: "challenge",
    points: 500,
    level: 2,
  },

  // Special Badges
  leaderboard_top5: {
    name: "Top Saver",
    emoji: "🏅",
    description: "Ranked in top 5 of monthly leaderboard",
    requirement: "Top 5 monthly leaderboard",
    category: "special",
    points: 300,
    level: 2,
  },
  leaderboard_top1: {
    name: "#1 Saver",
    emoji: "👑",
    description: "Ranked #1 in monthly leaderboard",
    requirement: "Number 1 monthly leaderboard",
    category: "special",
    points: 500,
    level: 3,
  },
  circle_created: {
    name: "Circle Leader",
    emoji: "👥",
    description: "Created a savings circle",
    requirement: "Create a savings circle",
    category: "special",
    points: 100,
    level: 1,
  },

  // Zakat Badge
  zakat_paid: {
    name: "Zakat Giver",
    emoji: "🤲",
    description: "Paid your annual Zakat",
    requirement: "Pay annual Zakat",
    category: "special",
    points: 150,
    level: 2,
  },
};

// Get user achievements
export const getUserAchievements = async (req, res) => {
  try {
    const userId = req.user._id;

    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");
    const withdrawalsCollection = db.collection("withdrawals");
    const goalsCollection = db.collection("goals");
    const referralsCollection = db.collection("referrals");
    const userChallengesCollection = db.collection("user_challenges");
    const achievementsCollection = db.collection("achievements");

    // Get user data
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user's earned achievements
    const earnedAchievements = await achievementsCollection
      .find({
        userId: new ObjectId(userId),
        earned: true,
      })
      .toArray();

    // Calculate user stats for badge unlocking
    const totalDeposits = await depositsCollection
      .find({ userId: new ObjectId(userId), status: "approved" })
      .toArray();
    
    const totalSaved = totalDeposits.reduce((sum, d) => sum + (d.depositAmount || 0), 0);
    
    const completedGoals = await goalsCollection.countDocuments({
      userId: new ObjectId(userId),
      status: "completed",
    });
    
    const referralCount = await referralsCollection.countDocuments({
      referredBy: userId,
      status: "active",
    });
    
    const userStreak = user.streak || 0;
    const completedChallenges = await userChallengesCollection.countDocuments({
      userId: new ObjectId(userId),
      status: "completed",
    });

    // Check which badges are unlocked
    const earnedBadgeIds = earnedAchievements.map(e => e.badgeId);
    const unlockedBadges = [];
    const lockedBadges = [];

    for (const [badgeId, config] of Object.entries(BADGE_CONFIGS)) {
      let isEarned = earnedBadgeIds.includes(badgeId);
      let progress = 0;
      let target = 0;
      
      if (!isEarned) {
        // Calculate progress based on badge type
        if (badgeId.startsWith("streak_")) {
          const streakTarget = parseInt(badgeId.split("_")[1]);
          progress = Math.min(userStreak, streakTarget);
          target = streakTarget;
          isEarned = userStreak >= streakTarget;
        } else if (badgeId.startsWith("savings_")) {
          const savingsTarget = parseInt(badgeId.split("_")[1]);
          progress = Math.min(totalSaved, savingsTarget);
          target = savingsTarget;
          isEarned = totalSaved >= savingsTarget;
        } else if (badgeId.startsWith("goal_complete_")) {
          const goalTarget = parseInt(badgeId.split("_")[2]);
          progress = Math.min(completedGoals, goalTarget);
          target = goalTarget;
          isEarned = completedGoals >= goalTarget;
        } else if (badgeId.startsWith("referral_")) {
          const referralTarget = parseInt(badgeId.split("_")[1]);
          progress = Math.min(referralCount, referralTarget);
          target = referralTarget;
          isEarned = referralCount >= referralTarget;
        } else if (badgeId.startsWith("challenge_")) {
          // Check if specific challenge completed
          if (badgeId === "challenge_ramadan") {
            const ramadanChallenge = await userChallengesCollection.findOne({
              userId: new ObjectId(userId),
              challengeName: { $regex: "Ramadan", $options: "i" },
              status: "completed",
            });
            isEarned = !!ramadanChallenge;
          } else if (badgeId === "challenge_eid") {
            const eidChallenge = await userChallengesCollection.findOne({
              userId: new ObjectId(userId),
              challengeName: { $regex: "Eid", $options: "i" },
              status: "completed",
            });
            isEarned = !!eidChallenge;
          } else if (badgeId === "challenge_100day") {
            const hundredDayChallenge = await userChallengesCollection.findOne({
              userId: new ObjectId(userId),
              challengeName: { $regex: "100", $options: "i" },
              status: "completed",
            });
            isEarned = !!hundredDayChallenge;
          }
        } else if (badgeId === "circle_created") {
          const hasCircle = user.circles && user.circles.length > 0;
          progress = hasCircle ? 1 : 0;
          target = 1;
          isEarned = hasCircle;
        } else if (badgeId === "zakat_paid") {
          // Check if user has paid zakat (you can implement zakat tracking)
          const hasPaidZakat = user.zakatPaid || false;
          progress = hasPaidZakat ? 1 : 0;
          target = 1;
          isEarned = hasPaidZakat;
        } else if (badgeId === "leaderboard_top5" || badgeId === "leaderboard_top1") {
          // This would require checking leaderboard position
          // For now, mark as not earned
          isEarned = false;
        }
      }
      
      const badge = {
        id: badgeId,
        name: config.name,
        emoji: config.emoji,
        description: config.description,
        requirement: config.requirement,
        category: config.category,
        points: config.points,
        level: config.level,
        earned: isEarned,
        earnedAt: isEarned ? (earnedAchievements.find(e => e.badgeId === badgeId)?.earnedAt || new Date()) : null,
      };
      
      if (!isEarned && progress > 0) {
        badge.progress = progress;
        badge.target = target;
      }
      
      if (isEarned) {
        unlockedBadges.push(badge);
      } else {
        lockedBadges.push(badge);
      }
      
      // If newly earned, save to database
      if (isEarned && !earnedBadgeIds.includes(badgeId)) {
        await achievementsCollection.insertOne({
          userId: new ObjectId(userId),
          badgeId: badgeId,
          badgeName: config.name,
          category: config.category,
          points: config.points,
          earnedAt: new Date(),
          createdAt: new Date(),
        });
        
        // Update user's total points
        const totalPoints = (user.totalPoints || 0) + config.points;
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { 
            $set: { totalPoints: totalPoints },
            $inc: { totalAchievements: 1 }
          }
        );
      }
    }

    // Calculate user level based on total points
    const userTotalPoints = user.totalPoints || 0;
    const userLevel = Math.floor(Math.sqrt(userTotalPoints / 100)) + 1;
    const nextLevelPoints = Math.pow(userLevel, 2) * 100;
    const pointsToNextLevel = nextLevelPoints - userTotalPoints;

    // Get category statistics
    const categoryStats = {
      streak: unlockedBadges.filter(b => b.category === "streak").length,
      savings: unlockedBadges.filter(b => b.category === "savings").length,
      goal: unlockedBadges.filter(b => b.category === "goal").length,
      referral: unlockedBadges.filter(b => b.category === "referral").length,
      challenge: unlockedBadges.filter(b => b.category === "challenge").length,
      special: unlockedBadges.filter(b => b.category === "special").length,
    };

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalEarned: unlockedBadges.length,
          totalLocked: lockedBadges.length,
          totalPoints: userTotalPoints,
          level: userLevel,
          nextLevelPoints,
          pointsToNextLevel,
          categoryStats,
        },
        earnedBadges: unlockedBadges,
        lockedBadges: lockedBadges,
        recentAchievements: unlockedBadges.slice(-5).reverse(),
      },
    });
  } catch (error) {
    console.error("Get user achievements error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch achievements",
    });
  }
};

// Get single badge details
export const getBadgeDetails = async (req, res) => {
  try {
    const { badgeId } = req.params;
    const userId = req.user._id;

    const badge = BADGE_CONFIGS[badgeId];
    if (!badge) {
      return res.status(404).json({
        success: false,
        message: "Badge not found",
      });
    }

    const achievementsCollection = db.collection("achievements");
    const userAchievement = await achievementsCollection.findOne({
      userId: new ObjectId(userId),
      badgeId: badgeId,
    });

    return res.status(200).json({
      success: true,
      data: {
        badge: {
          id: badgeId,
          ...badge,
          earned: !!userAchievement,
          earnedAt: userAchievement?.earnedAt || null,
        },
      },
    });
  } catch (error) {
    console.error("Get badge details error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch badge details",
    });
  }
};

// Get leaderboard by points
export const getPointsLeaderboard = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const usersCollection = db.collection("users");

    const leaderboard = await usersCollection
      .find(
        { role: "user", accountActive: true },
        {
          projection: {
            fullName: 1,
            firstName: 1,
            profilePicture: 1,
            totalPoints: 1,
            totalAchievements: 1,
            level: 1,
          },
        }
      )
      .sort({ totalPoints: -1 })
      .limit(parseInt(limit))
      .toArray();

    const formattedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      rankIcon: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`,
      name: user.fullName || user.firstName || "Anonymous",
      profilePicture: user.profilePicture,
      points: user.totalPoints || 0,
      badges: user.totalAchievements || 0,
      level: user.level || 1,
    }));

    return res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        total: leaderboard.length,
      },
    });
  } catch (error) {
    console.error("Get points leaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch leaderboard",
    });
  }
};

// Get user level and points
export const getUserLevelInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      {
        projection: {
          fullName: 1,
          totalPoints: 1,
          totalAchievements: 1,
          streak: 1,
        },
      }
    );

    const totalPoints = user?.totalPoints || 0;
    const level = Math.floor(Math.sqrt(totalPoints / 100)) + 1;
    const nextLevelPoints = Math.pow(level, 2) * 100;
    const pointsToNextLevel = nextLevelPoints - totalPoints;
    const progressToNextLevel = ((totalPoints - Math.pow(level - 1, 2) * 100) / (nextLevelPoints - Math.pow(level - 1, 2) * 100)) * 100;

    // Get next 3 badges to unlock
    const achievementsCollection = db.collection("achievements");
    const earnedBadges = await achievementsCollection
      .find({ userId: new ObjectId(userId) })
      .toArray();
    
    const earnedBadgeIds = earnedBadges.map(e => e.badgeId);
    const nextBadges = [];

    for (const [badgeId, config] of Object.entries(BADGE_CONFIGS)) {
      if (!earnedBadgeIds.includes(badgeId) && nextBadges.length < 3) {
        nextBadges.push({
          id: badgeId,
          name: config.name,
          emoji: config.emoji,
          points: config.points,
          requirement: config.requirement,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        level,
        totalPoints,
        totalBadges: user?.totalAchievements || 0,
        streak: user?.streak || 0,
        nextLevelPoints,
        pointsToNextLevel,
        progressToNextLevel: Math.min(100, progressToNextLevel),
        nextBadges,
      },
    });
  } catch (error) {
    console.error("Get user level info error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch level info",
    });
  }
};

// Admin: Get all achievements for a user
export const getUserAchievementsAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    const achievementsCollection = db.collection("achievements");
    const achievements = await achievementsCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ earnedAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: achievements,
    });
  } catch (error) {
    console.error("Get user achievements admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch achievements",
    });
  }
};