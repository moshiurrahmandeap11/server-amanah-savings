// controllers/zakat/zakat.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Calculate zakat based on user input
export const calculateZakat = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      goldRate,
      silverRate,
      assets,
      liabilities,
    } = req.body;

    const ZAKAT_RATE = 0.025;

    // Validate inputs
    if (!goldRate || goldRate <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid gold rate is required",
      });
    }

    // Use silver rate from user input or default
    const silverRatePerGram = silverRate || 130;

    // Calculate total assets
    const totalAssets = 
      (assets?.cash || 0) +
      (assets?.sanchoy || 0) +
      (assets?.mobile || 0) +
      (assets?.invest || 0) +
      ((assets?.gold_g || 0) * goldRate) +
      ((assets?.silver_g || 0) * silverRatePerGram) +
      (assets?.stock || 0) +
      (assets?.recv || 0);

    // Calculate total liabilities
    const totalLiabilities = 
      (liabilities?.loan || 0) +
      (liabilities?.bills || 0) +
      (liabilities?.other || 0);

    // Calculate net zakatable wealth
    const net = Math.max(0, totalAssets - totalLiabilities);
    
    // Calculate nisab (85g gold value)
    const nisab = goldRate * 85;
    
    // Check if above nisab
    const aboveNisab = net >= nisab;
    
    // Calculate zakat due
    const zakatDue = aboveNisab ? net * ZAKAT_RATE : 0;

    // Round to 2 decimal places
    const roundedZakatDue = Math.round(zakatDue * 100) / 100;

    // Save calculation to history
    const zakatCollection = db.collection("zakat_calculations");
    
    const calculation = {
      userId: new ObjectId(userId),
      goldRate,
      silverRate: silverRatePerGram,
      assets,
      liabilities,
      totalAssets,
      totalLiabilities,
      net,
      nisab,
      aboveNisab,
      zakatDue: roundedZakatDue,
      calculatedAt: new Date(),
    };

    await zakatCollection.insertOne(calculation);

    return res.status(200).json({
      success: true,
      data: {
        totalAssets,
        totalLiabilities,
        net,
        nisab,
        aboveNisab,
        zakatDue: roundedZakatDue,
        zakatDueFormatted: `৳${Math.round(roundedZakatDue).toLocaleString()}`,
      },
    });
  } catch (error) {
    console.error("Calculate zakat error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to calculate zakat",
    });
  }
};

// Create zakat goal (special goal for zakat savings)
export const createZakatGoal = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      zakatAmount,
      targetDate,
      description,
    } = req.body;

    if (!zakatAmount || zakatAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid zakat amount is required",
      });
    }

    const usersCollection = db.collection("users");
    const goalsCollection = db.collection("goals");
    const zakatCollection = db.collection("zakat_calculations");

    // Check if user exists
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate duration (default to 1 year if no target date)
    let targetDateObj;
    let durationInMonths = 12;
    
    if (targetDate) {
      targetDateObj = new Date(targetDate);
      const currentDate = new Date();
      const diffTime = Math.abs(targetDateObj - currentDate);
      durationInMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    } else {
      targetDateObj = new Date();
      targetDateObj.setMonth(targetDateObj.getMonth() + 12);
    }

    // Calculate monthly deposit for zakat goal
    const monthlyDeposit = Math.ceil(zakatAmount / durationInMonths);

    // Create special zakat goal
    const newGoal = {
      userId: new ObjectId(userId),
      goalType: "zakat",
      goalName: "Zakat Fund - Yearly Charity",
      targetAmount: parseFloat(zakatAmount),
      monthlyDeposit: monthlyDeposit,
      targetDate: targetDateObj,
      description: description || "Zakat savings for yearly charity distribution",
      islamicMode: true,
      currentSaved: 0,
      progress: 0,
      status: "active",
      durationInMonths,
      estimatedCompletionDate: targetDateObj,
      isZakatGoal: true,
      zakatYear: new Date().getFullYear(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await goalsCollection.insertOne(newGoal);

    // Also update user's goals array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          goals: {
            goalId: result.insertedId,
            goalName: "Zakat Fund - Yearly Charity",
            goalType: "zakat",
            targetAmount: parseFloat(zakatAmount),
            monthlyDeposit: monthlyDeposit,
            currentSaved: 0,
            progress: 0,
            status: "active",
            targetDate: targetDateObj,
            estimatedCompletionDate: targetDateObj,
            isZakatGoal: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      }
    );

    // Update the zakat calculation with goal reference
    await zakatCollection.updateOne(
      { userId: new ObjectId(userId) },
      { $set: { zakatGoalId: result.insertedId, goalCreatedAt: new Date() } },
      { sort: { calculatedAt: -1 } }
    );

    const goal = { ...newGoal, _id: result.insertedId };

    return res.status(201).json({
      success: true,
      message: "Zakat goal created successfully",
      data: goal,
    });
  } catch (error) {
    console.error("Create zakat goal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create zakat goal",
    });
  }
};

// Get user's zakat calculation history
export const getZakatHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { year, page = 1, limit = 10 } = req.query;

    const zakatCollection = db.collection("zakat_calculations");
    
    const query = { userId: new ObjectId(userId) };
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      query.calculatedAt = { $gte: startDate, $lte: endDate };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const calculations = await zakatCollection
      .find(query)
      .sort({ calculatedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await zakatCollection.countDocuments(query);

    // Get yearly summary
    const summary = await zakatCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: { $year: "$calculatedAt" },
          totalZakatDue: { $sum: "$zakatDue" },
          count: { $sum: 1 },
          averageZakat: { $avg: "$zakatDue" },
        },
      },
      { $sort: { _id: -1 } },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        calculations,
        summary,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get zakat history error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch zakat history",
    });
  }
};

// Get current year's zakat calculation
export const getCurrentZakat = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentYear = new Date().getFullYear();
    const startDate = new Date(`${currentYear}-01-01`);
    const endDate = new Date(`${currentYear}-12-31`);

    const zakatCollection = db.collection("zakat_calculations");
    
    const calculation = await zakatCollection.findOne({
      userId: new ObjectId(userId),
      calculatedAt: { $gte: startDate, $lte: endDate },
    });

    return res.status(200).json({
      success: true,
      data: calculation || null,
    });
  } catch (error) {
    console.error("Get current zakat error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch current zakat",
    });
  }
};

// Get zakat statistics for user
export const getZakatStatistics = async (req, res) => {
  try {
    const userId = req.user._id;

    const zakatCollection = db.collection("zakat_calculations");
    const goalsCollection = db.collection("goals");

    // Total zakat ever calculated
    const totalZakatStats = await zakatCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalZakatDue: { $sum: "$zakatDue" },
          totalCalculations: { $sum: 1 },
          averageZakat: { $avg: "$zakatDue" },
          lastCalculated: { $max: "$calculatedAt" },
        },
      },
    ]).toArray();

    // Check if user has zakat goal
    const zakatGoal = await goalsCollection.findOne({
      userId: new ObjectId(userId),
      goalType: "zakat",
      status: "active",
    });

    // Zakat by year
    const yearlyZakat = await zakatCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: { $year: "$calculatedAt" },
          totalZakat: { $sum: "$zakatDue" },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 5 },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        totalZakatDue: totalZakatStats[0]?.totalZakatDue || 0,
        totalCalculations: totalZakatStats[0]?.totalCalculations || 0,
        averageZakat: totalZakatStats[0]?.averageZakat || 0,
        lastCalculated: totalZakatStats[0]?.lastCalculated || null,
        hasZakatGoal: !!zakatGoal,
        zakatGoalId: zakatGoal?._id || null,
        zakatGoalProgress: zakatGoal?.progress || 0,
        yearlyZakat,
      },
    });
  } catch (error) {
    console.error("Get zakat statistics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch zakat statistics",
    });
  }
};

// Save zakat calculation (without creating goal)
export const saveZakatCalculation = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      goldRate,
      silverRate,
      assets,
      liabilities,
      totalAssets,
      totalLiabilities,
      net,
      nisab,
      aboveNisab,
      zakatDue,
    } = req.body;

    const zakatCollection = db.collection("zakat_calculations");

    const calculation = {
      userId: new ObjectId(userId),
      goldRate,
      silverRate: silverRate || 130,
      assets,
      liabilities,
      totalAssets,
      totalLiabilities,
      net,
      nisab,
      aboveNisab,
      zakatDue,
      calculatedAt: new Date(),
    };

    const result = await zakatCollection.insertOne(calculation);

    return res.status(201).json({
      success: true,
      message: "Zakat calculation saved successfully",
      data: { ...calculation, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Save zakat calculation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save zakat calculation",
    });
  }
};

// Admin: Get all zakat calculations
export const getAllZakatCalculations = async (req, res) => {
  try {
    const { year, page = 1, limit = 20 } = req.query;

    const zakatCollection = db.collection("zakat_calculations");
    
    const query = {};
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      query.calculatedAt = { $gte: startDate, $lte: endDate };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const calculations = await zakatCollection
      .aggregate([
        { $match: query },
        { $sort: { calculatedAt: -1 } },
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
            totalAssets: 1,
            totalLiabilities: 1,
            net: 1,
            nisab: 1,
            aboveNisab: 1,
            zakatDue: 1,
            calculatedAt: 1,
            "user.name": 1,
            "user.email": 1,
            "user.phone": 1,
          },
        },
      ])
      .toArray();

    const total = await zakatCollection.countDocuments(query);

    // Get summary statistics
    const summary = await zakatCollection.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalZakatDue: { $sum: "$zakatDue" },
          totalCalculations: { $sum: 1 },
          averageZakat: { $avg: "$zakatDue" },
          aboveNisabCount: {
            $sum: { $cond: [{ $eq: ["$aboveNisab", true] }, 1, 0] }
          },
        },
      },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        calculations,
        summary: summary[0] || {
          totalZakatDue: 0,
          totalCalculations: 0,
          averageZakat: 0,
          aboveNisabCount: 0,
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
    console.error("Get all zakat calculations error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch zakat calculations",
    });
  }
};