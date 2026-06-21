// controllers/goal.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

const visibleUserGoalFilter = {
  goalType: { $ne: "bonus" },
  goalName: { $ne: "Referral Bonus" },
};

// Create a new goal
export const createGoal = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      goalType,
      goalName,
      targetAmount,
      monthlyDeposit,
      targetDate,
      description,
      islamicMode,
    } = req.body;

    // Validation
    const requiredFields = [];
    if (!goalType) requiredFields.push("goalType");
    if (!goalName) requiredFields.push("goalName");
    if (!targetAmount) requiredFields.push("targetAmount");
    if (!monthlyDeposit) requiredFields.push("monthlyDeposit");
    if (!targetDate) requiredFields.push("targetDate");

    if (requiredFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${requiredFields.join(", ")}`,
        requiredFields,
      });
    }

    // Validate amounts
    const targetAmountNum = parseFloat(targetAmount);
    const monthlyDepositNum = parseFloat(monthlyDeposit);

    if (targetAmountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Target amount must be greater than 0",
      });
    }

    if (monthlyDepositNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Monthly deposit must be greater than 0",
      });
    }

    if (monthlyDepositNum > targetAmountNum) {
      return res.status(400).json({
        success: false,
        message: "Monthly deposit cannot exceed target amount",
      });
    }

    // Calculate duration in months
    const durationInMonths = Math.ceil(targetAmountNum / monthlyDepositNum);
    const targetDateObj = new Date(targetDate);
    const currentDate = new Date();

    // Calculate estimated completion date
    const estimatedCompletionDate = new Date(currentDate);
    estimatedCompletionDate.setMonth(currentDate.getMonth() + durationInMonths);

    // Check if target date is valid
    if (targetDateObj < currentDate) {
      return res.status(400).json({
        success: false,
        message: "Target date must be in the future",
      });
    }

    const usersCollection = db.collection("users");
    const goalsCollection = db.collection("goals");

    // Check if user exists
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Create goal object
    const newGoal = {
      userId: new ObjectId(userId),
      goalType,
      goalName,
      targetAmount: targetAmountNum,
      monthlyDeposit: monthlyDepositNum,
      targetDate: targetDateObj,
      description: description || null,
      islamicMode: islamicMode || false,
      currentSaved: 0,
      progress: 0,
      status: "active",
      durationInMonths,
      estimatedCompletionDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await goalsCollection.insertOne(newGoal);
    
    const goalId = result.insertedId;

    // Also update user's goals array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          goals: {
            goalId: goalId,
            goalName,
            goalType,
            targetAmount: targetAmountNum,
            monthlyDeposit: monthlyDepositNum,
            currentSaved: 0,
            progress: 0,
            status: "active",
            targetDate: targetDateObj,
            estimatedCompletionDate,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      }
    );

    const goal = { ...newGoal, _id: goalId };

    return res.status(201).json({
      success: true,
      message: "Goal created successfully",
      data: goal,
    });
  } catch (error) {
    console.error("Create goal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create goal",
    });
  }
};

// Get all public goals
export const getUserGoals = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const goalsCollection = db.collection("goals");
    
    const query = { ...visibleUserGoalFilter };
    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const goals = await goalsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await goalsCollection.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        goals,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get user goals error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch goals",
    });
  }
};

// Get single public goal by ID
export const getGoalById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID",
      });
    }

    const goalsCollection = db.collection("goals");
    const goal = await goalsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error("Get goal by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch goal",
    });
  }
};

// Get authenticated user's goals
export const getMyGoals = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 100 } = req.query;

    const goalsCollection = db.collection("goals");
    const query = { userId: new ObjectId(userId), ...visibleUserGoalFilter };

    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const goals = await goalsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await goalsCollection.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        goals,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get my goals error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch your goals",
    });
  }
};

// Admin: get all goals with owner details
export const getAllGoalsAdmin = async (req, res) => {
  try {
    const { status, page = 1, limit = 50, search = "" } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (pageNumber - 1) * limitNumber;

    const goalsCollection = db.collection("goals");
    const match = {
      goalType: { $ne: "bonus" },
      goalName: { $ne: "Referral Bonus" },
    };

    if (status && status !== "all") {
      match.status = status;
    }

    if (search) {
      match.$or = [
        { goalName: { $regex: search, $options: "i" } },
        { goalType: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [goals, total] = await Promise.all([
      goalsCollection
        .aggregate([
          { $match: match },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limitNumber },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "owner",
            },
          },
          { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              goalName: 1,
              goalType: 1,
              targetAmount: 1,
              monthlyDeposit: 1,
              currentSaved: 1,
              progress: 1,
              status: 1,
              targetDate: 1,
              estimatedCompletionDate: 1,
              islamicMode: 1,
              description: 1,
              createdAt: 1,
              updatedAt: 1,
              userId: 1,
              owner: {
                _id: "$owner._id",
                firstName: "$owner.firstName",
                lastName: "$owner.lastName",
                fullName: "$owner.fullName",
                phone: "$owner.phone",
                email: "$owner.email",
              },
            },
          },
        ])
        .toArray(),
      goalsCollection.countDocuments(match),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        goals,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalItems: total,
          itemsPerPage: limitNumber,
        },
      },
    });
  } catch (error) {
    console.error("Get all goals admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch admin goals",
    });
  }
};

// Admin: delete any goal
export const deleteGoalAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID",
      });
    }

    const goalsCollection = db.collection("goals");
    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");
    const goalObjectId = new ObjectId(id);

    const goal = await goalsCollection.findOne({ _id: goalObjectId });
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found",
      });
    }

    await Promise.all([
      goalsCollection.deleteOne({ _id: goalObjectId }),
      usersCollection.updateMany(
        {},
        { $pull: { goals: { goalId: goalObjectId } } }
      ),
      depositsCollection.updateMany(
        { goalId: goalObjectId },
        {
          $set: {
            goalDeleted: true,
            deletedByAdmin: new ObjectId(req.user._id),
            goalDeletedAt: new Date(),
          },
        }
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: "Goal deleted successfully",
    });
  } catch (error) {
    console.error("Delete goal admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete goal",
    });
  }
};

// Update goal
export const updateGoal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const {
      goalName,
      targetAmount,
      monthlyDeposit,
      targetDate,
      description,
      islamicMode,
      status,
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID",
      });
    }

    const goalsCollection = db.collection("goals");
    const usersCollection = db.collection("users");

    const existingGoal = await goalsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!existingGoal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found",
      });
    }

    const updateData = {};
    if (goalName) updateData.goalName = goalName;
    if (description !== undefined) updateData.description = description;
    if (islamicMode !== undefined) updateData.islamicMode = islamicMode;
    if (status) updateData.status = status;

    // Update target amount if provided
    if (targetAmount) {
      const newTargetAmount = parseFloat(targetAmount);
      if (newTargetAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Target amount must be greater than 0",
        });
      }
      updateData.targetAmount = newTargetAmount;
      
      // Recalculate duration
      const monthlyDepositValue = monthlyDeposit ? parseFloat(monthlyDeposit) : existingGoal.monthlyDeposit;
      updateData.durationInMonths = Math.ceil(newTargetAmount / monthlyDepositValue);
      
      // Recalculate progress
      const currentSaved = existingGoal.currentSaved;
      updateData.progress = Math.min(Math.round((currentSaved / newTargetAmount) * 100), 100);
    }

    // Update monthly deposit if provided
    if (monthlyDeposit) {
      const newMonthlyDeposit = parseFloat(monthlyDeposit);
      if (newMonthlyDeposit <= 0) {
        return res.status(400).json({
          success: false,
          message: "Monthly deposit must be greater than 0",
        });
      }
      updateData.monthlyDeposit = newMonthlyDeposit;
      
      // Recalculate duration
      const targetAmountValue = targetAmount ? parseFloat(targetAmount) : existingGoal.targetAmount;
      updateData.durationInMonths = Math.ceil(targetAmountValue / newMonthlyDeposit);
    }

    // Update target date if provided
    if (targetDate) {
      const newTargetDate = new Date(targetDate);
      if (newTargetDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Target date must be in the future",
        });
      }
      updateData.targetDate = newTargetDate;
    }

    updateData.updatedAt = new Date();

    await goalsCollection.updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(userId) },
      { $set: updateData }
    );

    // Update user's goals array
    const userUpdateData = {};
    if (updateData.goalName) userUpdateData["goals.$.goalName"] = updateData.goalName;
    if (updateData.targetAmount) userUpdateData["goals.$.targetAmount"] = updateData.targetAmount;
    if (updateData.monthlyDeposit) userUpdateData["goals.$.monthlyDeposit"] = updateData.monthlyDeposit;
    if (updateData.status) userUpdateData["goals.$.status"] = updateData.status;
    if (updateData.progress) userUpdateData["goals.$.progress"] = updateData.progress;
    if (updateData.targetDate) userUpdateData["goals.$.targetDate"] = updateData.targetDate;
    
    if (Object.keys(userUpdateData).length > 0) {
      userUpdateData["goals.$.updatedAt"] = new Date();
      await usersCollection.updateOne(
        { _id: new ObjectId(userId), "goals.goalId": new ObjectId(id) },
        { $set: userUpdateData }
      );
    }

    const updatedGoal = await goalsCollection.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "Goal updated successfully",
      data: updatedGoal,
    });
  } catch (error) {
    console.error("Update goal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update goal",
    });
  }
};

// Delete goal
export const deleteGoal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID",
      });
    }

    const goalsCollection = db.collection("goals");
    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");

    const goal = await goalsCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found",
      });
    }

    // Check if goal has any savings
    if (goal.currentSaved > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete goal with existing savings",
      });
    }

    // Check if there are any pending deposits
    const pendingDeposits = await depositsCollection.findOne({
      goalId: new ObjectId(id),
      status: "pending"
    });

    if (pendingDeposits) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete goal with pending deposit requests",
      });
    }

    await goalsCollection.deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });

    // Remove goal from user's goals array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { goals: { goalId: new ObjectId(id) } } }
    );

    return res.status(200).json({
      success: true,
      message: "Goal deleted successfully",
    });
  } catch (error) {
    console.error("Delete goal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete goal",
    });
  }
};

// Pause or resume goal
export const toggleGoalStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID",
      });
    }

    if (!status || !["active", "paused"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status (active/paused) is required",
      });
    }

    const goalsCollection = db.collection("goals");
    const usersCollection = db.collection("users");

    const goal = await goalsCollection.findOne({
      _id: new ObjectId(id),
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
        message: "Cannot pause a completed goal",
      });
    }

    await goalsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    // Update user's goals array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId), "goals.goalId": new ObjectId(id) },
      {
        $set: {
          "goals.$.status": status,
          "goals.$.updatedAt": new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: `Goal ${status === "active" ? "resumed" : "paused"} successfully`,
      data: { goalId: id, status },
    });
  } catch (error) {
    console.error("Toggle goal status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update goal status",
    });
  }
};

// Get goal statistics
export const getGoalStatistics = async (req, res) => {
  try {
    const userId = req.user._id;

    const goalsCollection = db.collection("goals");

    const goals = await goalsCollection
      .find({ userId: new ObjectId(userId), ...visibleUserGoalFilter })
      .toArray();

    const totalGoals = goals.length;
    const activeGoals = goals.filter(g => g.status === "active").length;
    const completedGoals = goals.filter(g => g.status === "completed").length;
    const pausedGoals = goals.filter(g => g.status === "paused").length;
    const totalSaved = goals.reduce((sum, g) => sum + (g.currentSaved || 0), 0);
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const overallProgress = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalGoals,
        activeGoals,
        completedGoals,
        pausedGoals,
        totalSaved,
        totalTarget,
        overallProgress,
      },
    });
  } catch (error) {
    console.error("Get goal statistics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch statistics",
    });
  }
};
