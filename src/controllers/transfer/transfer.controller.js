// controllers/transfer/transfer.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Helper function to normalize phone numbers for search
const normalizePhoneForSearch = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it's 10 digits and starts with 1, it might be missing leading 0
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '0' + cleaned;
  }
  
  // If it has 88 (country code without +), remove it
  if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  
  // Ensure we have exactly 11 digits starting with 0 for Bangladesh
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return cleaned;
  }
  
  // If it's 11 digits starting with 1 (without leading 0), add 0
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return '0' + cleaned;
  }
  
  return cleaned;
};

// Validate Bangladesh phone number
const isValidBangladeshPhone = (phone) => {
  const normalized = normalizePhoneForSearch(phone);
  if (!normalized) return false;
  // Check if it's exactly 11 digits starting with 01 and 3-9 as second digit
  return /^01[3-9]\d{8}$/.test(normalized);
};

// Goal to Goal Transfer
export const goalToGoalTransfer = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      fromGoalId,
      toGoalId,
      amount,
      note,
    } = req.body;

    // Validation
    if (!fromGoalId || !toGoalId) {
      return res.status(400).json({
        success: false,
        message: "Both source and destination goals are required",
      });
    }

    if (fromGoalId === toGoalId) {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer to the same goal",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid transfer amount is required",
      });
    }

    if (amount < 10) {
      return res.status(400).json({
        success: false,
        message: "Minimum transfer amount is ৳10",
      });
    }

    const amountNum = parseFloat(amount);
    const usersCollection = db.collection("users");
    const goalsCollection = db.collection("goals");
    const transfersCollection = db.collection("transfers");

    // Check if user exists
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get source goal
    const fromGoal = await goalsCollection.findOne({
      _id: new ObjectId(fromGoalId),
      userId: new ObjectId(userId),
    });

    if (!fromGoal) {
      return res.status(404).json({
        success: false,
        message: "Source goal not found",
      });
    }

    if (fromGoal.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer from a completed goal",
      });
    }

    // Check sufficient balance
    if (fromGoal.currentSaved < amountNum) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ৳${fromGoal.currentSaved.toLocaleString()}`,
      });
    }

    // Get destination goal
    const toGoal = await goalsCollection.findOne({
      _id: new ObjectId(toGoalId),
      userId: new ObjectId(userId),
    });

    if (!toGoal) {
      return res.status(404).json({
        success: false,
        message: "Destination goal not found",
      });
    }

    if (toGoal.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer to a completed goal",
      });
    }

    // Start a session for transaction
    const session = db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update source goal (decrease)
        const newFromCurrentSaved = fromGoal.currentSaved - amountNum;
        const newFromProgress = Math.max(0, Math.min(Math.round((newFromCurrentSaved / fromGoal.targetAmount) * 100), 100));
        
        await goalsCollection.updateOne(
          { _id: new ObjectId(fromGoalId) },
          {
            $set: {
              currentSaved: newFromCurrentSaved,
              progress: newFromProgress,
              updatedAt: new Date(),
            }
          },
          { session }
        );

        // Update destination goal (increase)
        const newToCurrentSaved = toGoal.currentSaved + amountNum;
        const newToProgress = Math.min(Math.round((newToCurrentSaved / toGoal.targetAmount) * 100), 100);
        
        const toGoalUpdateData = {
          currentSaved: newToCurrentSaved,
          progress: newToProgress,
          updatedAt: new Date(),
        };
        
        if (newToCurrentSaved >= toGoal.targetAmount) {
          toGoalUpdateData.status = "completed";
          toGoalUpdateData.progress = 100;
        }
        
        await goalsCollection.updateOne(
          { _id: new ObjectId(toGoalId) },
          { $set: toGoalUpdateData },
          { session }
        );

        // Update user's goals array for source goal
        await usersCollection.updateOne(
          { _id: new ObjectId(userId), "goals.goalId": new ObjectId(fromGoalId) },
          {
            $set: {
              "goals.$.currentSaved": newFromCurrentSaved,
              "goals.$.progress": newFromProgress,
              "goals.$.updatedAt": new Date(),
            }
          },
          { session }
        );

        // Update user's goals array for destination goal
        await usersCollection.updateOne(
          { _id: new ObjectId(userId), "goals.goalId": new ObjectId(toGoalId) },
          {
            $set: {
              "goals.$.currentSaved": newToCurrentSaved,
              "goals.$.progress": newToProgress,
              "goals.$.status": newToCurrentSaved >= toGoal.targetAmount ? "completed" : "active",
              "goals.$.updatedAt": new Date(),
            }
          },
          { session }
        );

        // Create transfer record
        const transfer = {
          userId: new ObjectId(userId),
          type: "goal_to_goal",
          fromGoalId: new ObjectId(fromGoalId),
          toGoalId: new ObjectId(toGoalId),
          fromGoalName: fromGoal.goalName,
          toGoalName: toGoal.goalName,
          amount: amountNum,
          note: note || null,
          status: "completed",
          referenceNumber: `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await transfersCollection.insertOne(transfer, { session });
      });
      
      await session.endSession();

      return res.status(200).json({
        success: true,
        message: "Transfer completed successfully",
        data: {
          fromGoal: fromGoal.goalName,
          toGoal: toGoal.goalName,
          amount: amountNum,
          newFromBalance: fromGoal.currentSaved - amountNum,
          newToBalance: toGoal.currentSaved + amountNum,
        },
      });
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Goal to goal transfer error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to complete transfer",
    });
  }
};

// User to User Transfer
export const userToUserTransfer = async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const {
      toUserPhone,
      amount,
      note,
      fromGoalId,
    } = req.body;

    // Validation
    if (!toUserPhone) {
      return res.status(400).json({
        success: false,
        message: "Recipient phone number is required",
      });
    }

    if (!fromGoalId) {
      return res.status(400).json({
        success: false,
        message: "Source goal is required",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid transfer amount is required",
      });
    }

    if (amount < 10) {
      return res.status(400).json({
        success: false,
        message: "Minimum transfer amount is ৳10",
      });
    }

    const amountNum = parseFloat(amount);
    const usersCollection = db.collection("users");
    const goalsCollection = db.collection("goals");
    const transfersCollection = db.collection("transfers");

    // Check if sender exists
    const fromUser = await usersCollection.findOne({ _id: new ObjectId(fromUserId) });
    if (!fromUser) {
      return res.status(404).json({
        success: false,
        message: "Sender not found",
      });
    }

    // Normalize and find recipient by phone number
    const normalizedPhone = normalizePhoneForSearch(toUserPhone);
    if (!isValidBangladeshPhone(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format. Please enter a valid 11-digit Bangladesh phone number (e.g., 01409063324)",
      });
    }

    // Try to find recipient with multiple phone formats
    let toUser = await usersCollection.findOne({ phone: normalizedPhone });
    
    // If not found with normalized format, try without leading 0
    if (!toUser && normalizedPhone.startsWith('0')) {
      const withoutZero = normalizedPhone.substring(1);
      toUser = await usersCollection.findOne({ phone: withoutZero });
    }
    
    // If still not found, try with +88
    if (!toUser) {
      const withCountryCode = '+88' + normalizedPhone;
      toUser = await usersCollection.findOne({ phone: withCountryCode });
    }

    if (!toUser) {
      return res.status(404).json({
        success: false,
        message: "Recipient not found. Please check the phone number.",
      });
    }

    // Prevent self-transfer
    if (toUser._id.toString() === fromUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer to yourself",
      });
    }

    // Get source goal
    const fromGoal = await goalsCollection.findOne({
      _id: new ObjectId(fromGoalId),
      userId: new ObjectId(fromUserId),
    });

    if (!fromGoal) {
      return res.status(404).json({
        success: false,
        message: "Source goal not found",
      });
    }

    if (fromGoal.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer from a completed goal",
      });
    }

    // Check sufficient balance
    if (fromGoal.currentSaved < amountNum) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ৳${fromGoal.currentSaved.toLocaleString()}`,
      });
    }

    // Get or create recipient's default goal (or first active goal)
    let toGoal = await goalsCollection.findOne({
      userId: toUser._id,
      status: "active",
    });

    // If no active goal, create a default "General Savings" goal
    if (!toGoal) {
      const newGoal = {
        userId: toUser._id,
        goalType: "other",
        goalName: "General Savings",
        targetAmount: 1000000,
        monthlyDeposit: 10000,
        targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
        description: "Auto-created for receiving transfers",
        islamicMode: false,
        currentSaved: 0,
        progress: 0,
        status: "active",
        durationInMonths: 60,
        estimatedCompletionDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await goalsCollection.insertOne(newGoal);
      toGoal = { ...newGoal, _id: result.insertedId };

      // Add to recipient's goals array
      await usersCollection.updateOne(
        { _id: toUser._id },
        {
          $push: {
            goals: {
              goalId: result.insertedId,
              goalName: "General Savings",
              goalType: "other",
              targetAmount: 1000000,
              monthlyDeposit: 10000,
              currentSaved: 0,
              progress: 0,
              status: "active",
              targetDate: newGoal.targetDate,
              estimatedCompletionDate: newGoal.estimatedCompletionDate,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          }
        }
      );
    }

    // Start a session for transaction
    const session = db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update sender's goal (decrease)
        const newFromCurrentSaved = fromGoal.currentSaved - amountNum;
        const newFromProgress = Math.max(0, Math.min(Math.round((newFromCurrentSaved / fromGoal.targetAmount) * 100), 100));
        
        await goalsCollection.updateOne(
          { _id: new ObjectId(fromGoalId) },
          {
            $set: {
              currentSaved: newFromCurrentSaved,
              progress: newFromProgress,
              updatedAt: new Date(),
            }
          },
          { session }
        );

        // Update recipient's goal (increase)
        const newToCurrentSaved = (toGoal.currentSaved || 0) + amountNum;
        const newToProgress = Math.min(Math.round((newToCurrentSaved / toGoal.targetAmount) * 100), 100);
        
        const toGoalUpdateData = {
          currentSaved: newToCurrentSaved,
          progress: newToProgress,
          updatedAt: new Date(),
        };
        
        if (newToCurrentSaved >= toGoal.targetAmount) {
          toGoalUpdateData.status = "completed";
          toGoalUpdateData.progress = 100;
        }
        
        await goalsCollection.updateOne(
          { _id: toGoal._id },
          { $set: toGoalUpdateData },
          { session }
        );

        // Update sender's user goals array
        await usersCollection.updateOne(
          { _id: new ObjectId(fromUserId), "goals.goalId": new ObjectId(fromGoalId) },
          {
            $set: {
              "goals.$.currentSaved": newFromCurrentSaved,
              "goals.$.progress": newFromProgress,
              "goals.$.updatedAt": new Date(),
            }
          },
          { session }
        );

        // Update recipient's user goals array
        await usersCollection.updateOne(
          { _id: toUser._id, "goals.goalId": toGoal._id },
          {
            $set: {
              "goals.$.currentSaved": newToCurrentSaved,
              "goals.$.progress": newToProgress,
              "goals.$.status": newToCurrentSaved >= toGoal.targetAmount ? "completed" : "active",
              "goals.$.updatedAt": new Date(),
            }
          },
          { session }
        );

        // Create transfer record
        const transfer = {
          fromUserId: new ObjectId(fromUserId),
          toUserId: toUser._id,
          type: "user_to_user",
          fromGoalId: new ObjectId(fromGoalId),
          toGoalId: toGoal._id,
          fromGoalName: fromGoal.goalName,
          toGoalName: toGoal.goalName,
          fromUserName: fromUser.name,
          toUserName: toUser.name,
          toUserPhone: toUser.phone,
          amount: amountNum,
          note: note || null,
          status: "completed",
          referenceNumber: `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await transfersCollection.insertOne(transfer, { session });
      });
      
      await session.endSession();

      return res.status(200).json({
        success: true,
        message: `Transfer of ৳${amountNum.toLocaleString()} sent to ${toUser.name} successfully`,
        data: {
          toUser: toUser.name,
          toUserPhone: toUser.phone,
          amount: amountNum,
          newBalance: fromGoal.currentSaved - amountNum,
        },
      });
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("User to user transfer error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to complete transfer",
    });
  }
};

// Search user by phone number
export const searchUserByPhone = async (req, res) => {
  try {
    const userId = req.user._id;
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const usersCollection = db.collection("users");

    // Normalize the phone number for searching
    const normalizedPhone = normalizePhoneForSearch(phone);
    
    // Try multiple formats
    const phoneFormats = [];
    
    if (normalizedPhone) {
      // Add normalized format (01XXXXXXXXX)
      phoneFormats.push(normalizedPhone);
      
      // Add without leading 0 (1XXXXXXXXX)
      if (normalizedPhone.startsWith('0')) {
        phoneFormats.push(normalizedPhone.substring(1));
      }
      
      // Add with +88
      phoneFormats.push('+88' + normalizedPhone);
      
      // If it doesn't start with 0, try with 0
      if (!normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
        phoneFormats.push('0' + normalizedPhone);
      }
    }
    
    // Also try the original input
    const originalCleaned = phone.replace(/\D/g, '');
    if (!phoneFormats.includes(originalCleaned) && originalCleaned.length >= 10) {
      phoneFormats.push(originalCleaned);
    }

    // Remove duplicates
    const uniqueFormats = [...new Set(phoneFormats)];

    // Find user with any of the phone formats
    let user = null;
    for (const format of uniqueFormats) {
      if (format && format.length >= 10) {
        const found = await usersCollection.findOne(
          { phone: format },
          { projection: { password: 0, refreshToken: 0, goals: 0 } }
        );
        if (found) {
          user = found;
          break;
        }
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent searching self
    if (user._id.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer to yourself",
      });
    }

    // Format the response
    const responseData = {
      id: user._id,
      name: user.name || user.fullName || 'User',
      phone: user.phone,
      email: user.email || null,
      profilePicture: user.profilePicture || user.avatar || null,
    };

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Search user error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to search user",
    });
  }
};

// Get user's transfer history
export const getUserTransfers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, page = 1, limit = 20 } = req.query;

    const transfersCollection = db.collection("transfers");
    
    const query = {
      $or: [
        { userId: new ObjectId(userId) },
        { fromUserId: new ObjectId(userId) },
        { toUserId: new ObjectId(userId) }
      ]
    };
    
    if (type && type !== "all") {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const transfers = await transfersCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await transfersCollection.countDocuments(query);

    // Calculate summary
    const sentTransfers = await transfersCollection.aggregate([
      { $match: { fromUserId: new ObjectId(userId), status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]).toArray();

    const receivedTransfers = await transfersCollection.aggregate([
      { $match: { toUserId: new ObjectId(userId), status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        transfers,
        summary: {
          sent: {
            total: sentTransfers[0]?.total || 0,
            count: sentTransfers[0]?.count || 0,
          },
          received: {
            total: receivedTransfers[0]?.total || 0,
            count: receivedTransfers[0]?.count || 0,
          },
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
    console.error("Get user transfers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch transfers",
    });
  }
};

// Get single transfer by ID
export const getTransferById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer ID",
      });
    }

    const transfersCollection = db.collection("transfers");
    const transfer = await transfersCollection.findOne({
      _id: new ObjectId(id),
      $or: [
        { userId: new ObjectId(userId) },
        { fromUserId: new ObjectId(userId) },
        { toUserId: new ObjectId(userId) }
      ]
    });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Transfer not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    console.error("Get transfer by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch transfer",
    });
  }
};

// Admin: Get all transfers
export const getAllTransfers = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;

    const transfersCollection = db.collection("transfers");
    
    const query = {};
    if (type && type !== "all") {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const transfers = await transfersCollection
      .aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "users",
            localField: "fromUserId",
            foreignField: "_id",
            as: "fromUser",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "toUserId",
            foreignField: "_id",
            as: "toUser",
          },
        },
        {
          $project: {
            _id: 1,
            type: 1,
            amount: 1,
            note: 1,
            status: 1,
            referenceNumber: 1,
            createdAt: 1,
            fromGoalName: 1,
            toGoalName: 1,
            "fromUser.name": 1,
            "fromUser.phone": 1,
            "toUser.name": 1,
            "toUser.phone": 1,
          },
        },
      ])
      .toArray();

    const total = await transfersCollection.countDocuments(query);

    // Get statistics
    const statistics = await transfersCollection.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]).toArray();

    const stats = {
      goal_to_goal: statistics.find(s => s._id === "goal_to_goal") || { count: 0, totalAmount: 0 },
      user_to_user: statistics.find(s => s._id === "user_to_user") || { count: 0, totalAmount: 0 },
    };

    return res.status(200).json({
      success: true,
      data: {
        transfers,
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
    console.error("Get all transfers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch transfers",
    });
  }
};