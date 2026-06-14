// controllers/leaderboard/leaderboard.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Get leaderboard data for current month
export const getMonthlyLeaderboard = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { month, year } = req.query;
    
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    
    const depositsCollection = db.collection("deposits");
    const usersCollection = db.collection("users");
    
    // Aggregate deposits for the month
    const leaderboard = await depositsCollection.aggregate([
      {
        $match: {
          status: "approved",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$userId",
          totalSaved: { $sum: "$depositAmount" },
          depositCount: { $sum: 1 },
          lastDepositDate: { $max: "$createdAt" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          totalSaved: 1,
          depositCount: 1,
          lastDepositDate: 1,
          "user.fullName": 1,
          "user.firstName": 1,
          "user.lastName": 1,
          "user.profilePicture": 1,
          "user.level": 1,
          "user.streak": 1,
          "user.totalSaved": 1
        }
      },
      {
        $sort: { totalSaved: -1 }
      },
      {
        $limit: 100
      }
    ]).toArray();
    
    // Calculate user tier based on total saved
    const getTier = (totalSaved) => {
      if (totalSaved >= 500000) return "Platinum";
      if (totalSaved >= 200000) return "Gold";
      if (totalSaved >= 50000) return "Silver";
      if (totalSaved >= 10000) return "Bronze";
      return "Starter";
    };
    
    // Format leaderboard with ranks
    const formattedLeaderboard = leaderboard.map((user, index) => {
      let rank = (index + 1).toString();
      let rankIcon = "";
      
      if (index === 0) rankIcon = "🥇";
      else if (index === 1) rankIcon = "🥈";
      else if (index === 2) rankIcon = "🥉";
      else rankIcon = `${index + 1}`;
      
      const isMe = userId && user._id.toString() === userId.toString();
      const tier = getTier(user.totalSaved);
      const tierColors = {
        Platinum: "from-gray-400 to-gray-600",
        Gold: "from-amber-500 to-orange-500",
        Silver: "from-gray-400 to-gray-500",
        Bronze: "from-amber-600 to-orange-600",
        Starter: "from-primary to-primary-light"
      };
      
      return {
        rank: rankIcon || rank,
        rankNumber: index + 1,
        userId: user._id,
        name: user.user?.fullName || user.user?.firstName || "Unknown User",
        avatar: user.user?.fullName?.charAt(0)?.toUpperCase() || "U",
        streak: user.user?.streak || 0,
        tier: tier,
        tierColor: tierColors[tier],
        amount: `৳${user.totalSaved.toLocaleString()}`,
        amountRaw: user.totalSaved,
        depositCount: user.depositCount,
        lastDepositDate: user.lastDepositDate,
        profilePicture: user.user?.profilePicture,
        isMe: isMe,
      };
    });
    
    // Find user's position
    let userRank = null;
    if (userId) {
      const userPosition = formattedLeaderboard.findIndex(u => u.isMe);
      if (userPosition !== -1) {
        userRank = {
          position: userPosition + 1,
          totalSaved: formattedLeaderboard[userPosition].amountRaw,
          rankIcon: formattedLeaderboard[userPosition].rank,
          tier: formattedLeaderboard[userPosition].tier
        };
      } else {
        // User not in top 100, get their total from deposits
        const userDeposits = await depositsCollection.aggregate([
          {
            $match: {
              userId: new ObjectId(userId),
              status: "approved",
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalSaved: { $sum: "$depositAmount" },
              depositCount: { $sum: 1 }
            }
          }
        ]).toArray();
        
        const userTotal = userDeposits[0]?.totalSaved || 0;
        const userCount = await depositsCollection.countDocuments({
          userId: new ObjectId(userId),
          status: "approved",
          createdAt: { $gte: startDate, $lte: endDate }
        });
        
        // Count how many users have more than this user
        const higherUsers = await depositsCollection.aggregate([
          {
            $match: {
              status: "approved",
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: "$userId",
              totalSaved: { $sum: "$depositAmount" }
            }
          },
          {
            $match: {
              totalSaved: { $gt: userTotal }
            }
          },
          {
            $count: "count"
          }
        ]).toArray();
        
        const position = (higherUsers[0]?.count || 0) + 1;
        userRank = {
          position: position,
          totalSaved: userTotal,
          rankIcon: position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : position.toString(),
          tier: getTier(userTotal)
        };
      }
    }
    
    // Get statistics
    const totalSavers = leaderboard.length;
    const totalSaved = leaderboard.reduce((sum, u) => sum + u.totalSaved, 0);
    const averageSaved = totalSavers > 0 ? totalSaved / totalSavers : 0;
    
    return res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        userRank: userRank,
        statistics: {
          totalSavers,
          totalSaved: `৳${totalSaved.toLocaleString()}`,
          averageSaved: `৳${Math.round(averageSaved).toLocaleString()}`,
          topSaver: formattedLeaderboard[0]?.name || "N/A",
          topAmount: formattedLeaderboard[0]?.amount || "৳0"
        },
        period: {
          month: targetMonth,
          year: targetYear,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error("Get monthly leaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch leaderboard"
    });
  }
};

// Get all-time leaderboard
export const getAllTimeLeaderboard = async (req, res) => {
  try {
    const userId = req.user?._id;
    
    const depositsCollection = db.collection("deposits");
    const usersCollection = db.collection("users");
    
    // Aggregate all approved deposits
    const leaderboard = await depositsCollection.aggregate([
      {
        $match: {
          status: "approved"
        }
      },
      {
        $group: {
          _id: "$userId",
          totalSaved: { $sum: "$depositAmount" },
          depositCount: { $sum: 1 },
          firstDepositDate: { $min: "$createdAt" },
          lastDepositDate: { $max: "$createdAt" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          totalSaved: 1,
          depositCount: 1,
          firstDepositDate: 1,
          lastDepositDate: 1,
          "user.fullName": 1,
          "user.firstName": 1,
          "user.lastName": 1,
          "user.profilePicture": 1,
          "user.level": 1,
          "user.streak": 1,
          "user.totalSaved": 1,
          "user.createdAt": 1
        }
      },
      {
        $sort: { totalSaved: -1 }
      },
      {
        $limit: 100
      }
    ]).toArray();
    
    // Calculate user tier
    const getTier = (totalSaved) => {
      if (totalSaved >= 500000) return "Platinum";
      if (totalSaved >= 200000) return "Gold";
      if (totalSaved >= 50000) return "Silver";
      if (totalSaved >= 10000) return "Bronze";
      return "Starter";
    };
    
    // Format leaderboard with ranks
    const formattedLeaderboard = leaderboard.map((user, index) => {
      let rank = (index + 1).toString();
      let rankIcon = "";
      
      if (index === 0) rankIcon = "🥇";
      else if (index === 1) rankIcon = "🥈";
      else if (index === 2) rankIcon = "🥉";
      else rankIcon = `${index + 1}`;
      
      const isMe = userId && user._id.toString() === userId.toString();
      const tier = getTier(user.totalSaved);
      const tierColors = {
        Platinum: "from-gray-400 to-gray-600",
        Gold: "from-amber-500 to-orange-500",
        Silver: "from-gray-400 to-gray-500",
        Bronze: "from-amber-600 to-orange-600",
        Starter: "from-primary to-primary-light"
      };
      
      const daysActive = user.user?.createdAt 
        ? Math.ceil((new Date() - new Date(user.user.createdAt)) / (1000 * 60 * 60 * 24))
        : 0;
      
      return {
        rank: rankIcon || rank,
        rankNumber: index + 1,
        userId: user._id,
        name: user.user?.fullName || user.user?.firstName || "Unknown User",
        avatar: user.user?.fullName?.charAt(0)?.toUpperCase() || "U",
        streak: user.user?.streak || 0,
        daysActive: daysActive,
        tier: tier,
        tierColor: tierColors[tier],
        amount: `৳${user.totalSaved.toLocaleString()}`,
        amountRaw: user.totalSaved,
        depositCount: user.depositCount,
        memberSince: user.user?.createdAt,
        profilePicture: user.user?.profilePicture,
        isMe: isMe,
      };
    });
    
    // Find user's position
    let userRank = null;
    if (userId) {
      const userPosition = formattedLeaderboard.findIndex(u => u.isMe);
      if (userPosition !== -1) {
        userRank = {
          position: userPosition + 1,
          totalSaved: formattedLeaderboard[userPosition].amountRaw,
          rankIcon: formattedLeaderboard[userPosition].rank,
          tier: formattedLeaderboard[userPosition].tier,
          depositCount: formattedLeaderboard[userPosition].depositCount
        };
      } else {
        // User not in top 100
        const userDeposits = await depositsCollection.aggregate([
          {
            $match: {
              userId: new ObjectId(userId),
              status: "approved"
            }
          },
          {
            $group: {
              _id: null,
              totalSaved: { $sum: "$depositAmount" },
              depositCount: { $sum: 1 }
            }
          }
        ]).toArray();
        
        const userTotal = userDeposits[0]?.totalSaved || 0;
        
        const higherUsers = await depositsCollection.aggregate([
          {
            $match: {
              status: "approved"
            }
          },
          {
            $group: {
              _id: "$userId",
              totalSaved: { $sum: "$depositAmount" }
            }
          },
          {
            $match: {
              totalSaved: { $gt: userTotal }
            }
          },
          {
            $count: "count"
          }
        ]).toArray();
        
        const position = (higherUsers[0]?.count || 0) + 1;
        userRank = {
          position: position,
          totalSaved: userTotal,
          rankIcon: position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : position.toString(),
          tier: getTier(userTotal),
          depositCount: userDeposits[0]?.depositCount || 0
        };
      }
    }
    
    // Get statistics
    const totalSavers = leaderboard.length;
    const totalSaved = leaderboard.reduce((sum, u) => sum + u.totalSaved, 0);
    const averageSaved = totalSavers > 0 ? totalSaved / totalSavers : 0;
    
    return res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        userRank: userRank,
        statistics: {
          totalSavers,
          totalSaved: `৳${totalSaved.toLocaleString()}`,
          averageSaved: `৳${Math.round(averageSaved).toLocaleString()}`,
          topSaver: formattedLeaderboard[0]?.name || "N/A",
          topAmount: formattedLeaderboard[0]?.amount || "৳0"
        }
      }
    });
  } catch (error) {
    console.error("Get all-time leaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch leaderboard"
    });
  }
};

// Get leaderboard by goal type
export const getGoalTypeLeaderboard = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { goalType } = req.params;
    
    if (!goalType) {
      return res.status(400).json({
        success: false,
        message: "Goal type is required"
      });
    }
    
    const depositsCollection = db.collection("deposits");
    
    const leaderboard = await depositsCollection.aggregate([
      {
        $match: {
          status: "approved",
          goalType: goalType
        }
      },
      {
        $group: {
          _id: "$userId",
          totalSaved: { $sum: "$depositAmount" },
          depositCount: { $sum: 1 },
          goalName: { $first: "$goalName" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          totalSaved: 1,
          depositCount: 1,
          goalName: 1,
          "user.fullName": 1,
          "user.firstName": 1,
          "user.profilePicture": 1
        }
      },
      {
        $sort: { totalSaved: -1 }
      },
      {
        $limit: 50
      }
    ]).toArray();
    
    const formattedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      rankIcon: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`,
      name: user.user?.fullName || user.user?.firstName || "Unknown User",
      amount: `৳${user.totalSaved.toLocaleString()}`,
      goalName: user.goalName,
      depositCount: user.depositCount
    }));
    
    return res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        goalType: goalType,
        totalSavers: leaderboard.length
      }
    });
  } catch (error) {
    console.error("Get goal type leaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch goal type leaderboard"
    });
  }
};

// Get user's rank and stats
export const getUserRankStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const depositsCollection = db.collection("deposits");
    const usersCollection = db.collection("users");
    
    // Get user's total saved
    const userTotal = await depositsCollection.aggregate([
      {
        $match: {
          userId: new ObjectId(userId),
          status: "approved"
        }
      },
      {
        $group: {
          _id: null,
          totalSaved: { $sum: "$depositAmount" },
          depositCount: { $sum: 1 },
          monthlyAverage: { $avg: "$depositAmount" }
        }
      }
    ]).toArray();
    
    // Get user's rank
    const higherUsers = await depositsCollection.aggregate([
      {
        $match: {
          status: "approved"
        }
      },
      {
        $group: {
          _id: "$userId",
          totalSaved: { $sum: "$depositAmount" }
        }
      },
      {
        $match: {
          totalSaved: { $gt: (userTotal[0]?.totalSaved || 0) }
        }
      },
      {
        $count: "count"
      }
    ]).toArray();
    
    const rank = (higherUsers[0]?.count || 0) + 1;
    const totalUsers = await depositsCollection.aggregate([
      {
        $match: { status: "approved" }
      },
      {
        $group: { _id: "$userId" }
      },
      {
        $count: "count"
      }
    ]).toArray();
    
    // Get user details
    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { fullName: 1, firstName: 1, profilePicture: 1, streak: 1, level: 1 } }
    );
    
    // Get tier
    const getTier = (totalSaved) => {
      if (totalSaved >= 500000) return "Platinum";
      if (totalSaved >= 200000) return "Gold";
      if (totalSaved >= 50000) return "Silver";
      if (totalSaved >= 10000) return "Bronze";
      return "Starter";
    };
    
    return res.status(200).json({
      success: true,
      data: {
        rank: rank,
        totalUsers: totalUsers[0]?.count || 0,
        topPercentile: ((rank / (totalUsers[0]?.count || 1)) * 100).toFixed(1),
        totalSaved: userTotal[0]?.totalSaved || 0,
        totalDeposits: userTotal[0]?.depositCount || 0,
        monthlyAverage: userTotal[0]?.monthlyAverage || 0,
        streak: user?.streak || 0,
        level: user?.level || 1,
        tier: getTier(userTotal[0]?.totalSaved || 0),
        name: user?.fullName || user?.firstName || "User",
        profilePicture: user?.profilePicture
      }
    });
  } catch (error) {
    console.error("Get user rank stats error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user rank stats"
    });
  }
};

// Get leaderboard by circle/group
export const getCircleLeaderboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { circleId } = req.params;
    
    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");
    
    // Get circle members
    const circle = await usersCollection.findOne(
      { 
        "circles._id": new ObjectId(circleId),
        "circles.members": new ObjectId(userId)
      },
      { projection: { "circles.$": 1 } }
    );
    
    if (!circle || !circle.circles || circle.circles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Circle not found"
      });
    }
    
    const circleMembers = circle.circles[0].members;
    
    // Get deposits for circle members
    const leaderboard = await depositsCollection.aggregate([
      {
        $match: {
          userId: { $in: circleMembers },
          status: "approved"
        }
      },
      {
        $group: {
          _id: "$userId",
          totalSaved: { $sum: "$depositAmount" },
          depositCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      },
      {
        $project: {
          _id: 1,
          totalSaved: 1,
          depositCount: 1,
          "user.fullName": 1,
          "user.firstName": 1,
          "user.profilePicture": 1
        }
      },
      {
        $sort: { totalSaved: -1 }
      }
    ]).toArray();
    
    const formattedLeaderboard = leaderboard.map((member, index) => ({
      rank: index + 1,
      rankIcon: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`,
      name: member.user?.fullName || member.user?.firstName || "Unknown",
      amount: `৳${member.totalSaved.toLocaleString()}`,
      depositCount: member.depositCount,
      isMe: member._id.toString() === userId.toString()
    }));
    
    return res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        circleName: circle.circles[0].name,
        totalMembers: circleMembers.length
      }
    });
  } catch (error) {
    console.error("Get circle leaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch circle leaderboard"
    });
  }
};