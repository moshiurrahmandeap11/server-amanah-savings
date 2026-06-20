// controllers/circle/circle.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Create a new circle
export const createCircle = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      circleName,
      purpose,
      targetAmount,
      maxMembers,
      minDeposit,
      description,
      circleType,
    } = req.body;

    // Validation
    const requiredFields = [];
    if (!circleName) requiredFields.push("circleName");
    if (!purpose) requiredFields.push("purpose");
    if (!targetAmount) requiredFields.push("targetAmount");
    if (!maxMembers) requiredFields.push("maxMembers");
    if (!minDeposit) requiredFields.push("minDeposit");

    if (requiredFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${requiredFields.join(", ")}`,
      });
    }

    // Validate amounts
    if (targetAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Target amount must be greater than 0",
      });
    }

    if (minDeposit <= 0) {
      return res.status(400).json({
        success: false,
        message: "Minimum deposit must be greater than 0",
      });
    }

    const usersCollection = db.collection("users");
    const circlesCollection = db.collection("circles");

    // Check if user exists
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate initial values
    const totalPool = 0;
    const currentMembers = 1; // Creator is the first member

    // Create circle object
    const newCircle = {
      circleName,
      purpose,
      targetAmount: parseFloat(targetAmount),
      maxMembers: parseInt(maxMembers),
      minDeposit: parseFloat(minDeposit),
      description: description || null,
      circleType: circleType || "private",
      createdBy: new ObjectId(userId),
      currentMembers,
      members: [{
        userId: new ObjectId(userId),
        joinedAt: new Date(),
        role: "admin",
        totalDeposited: 0,
      }],
      totalPool,
      status: "active", // active, completed, paused
      nextPayoutDate: null,
      currentPayoutIndex: 0,
      payoutHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await circlesCollection.insertOne(newCircle);

    // Update user's circles array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          circles: {
            circleId: result.insertedId,
            circleName,
            role: "admin",
            joinedAt: new Date(),
          },
        },
      }
    );

    const circle = { ...newCircle, _id: result.insertedId };

    return res.status(201).json({
      success: true,
      message: "Circle created successfully",
      data: circle,
    });
  } catch (error) {
    console.error("Create circle error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create circle",
    });
  }
};

// Get all circles for a user
export const getUserCircles = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const circlesCollection = db.collection("circles");
    
    const query = { "members.userId": new ObjectId(userId) };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const circles = await circlesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await circlesCollection.countDocuments(query);

    // Format circles for frontend
    const formattedCircles = circles.map(circle => ({
      _id: circle._id,
      emoji: getCircleEmoji(circle.purpose),
      name: circle.circleName,
      type: circle.circleType === "private" ? "Private Circle" : "Public Circle",
      members: circle.currentMembers,
      totalPool: `৳${circle.totalPool.toLocaleString()}`,
      nextPayout: circle.nextPayoutDate 
        ? new Date(circle.nextPayoutDate).toLocaleString('default', { month: 'short' })
        : "Not scheduled",
      color: getCircleColor(circle.purpose),
      status: circle.status,
      minDeposit: circle.minDeposit,
      targetAmount: circle.targetAmount,
      description: circle.description,
      purpose: circle.purpose,
      circleType: circle.circleType,
      currentMembers: circle.currentMembers,
      maxMembers: circle.maxMembers,
      membersList: circle.members,
      totalPoolValue: circle.totalPool,
      createdAt: circle.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        circles: formattedCircles,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get user circles error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch circles",
    });
  }
};

// Get single circle by ID
export const getCircleById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

    const circlesCollection = db.collection("circles");
    const circle = await circlesCollection.findOne({
      _id: new ObjectId(id),
      "members.userId": new ObjectId(userId),
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found",
      });
    }

    const formattedCircle = {
      _id: circle._id,
      emoji: getCircleEmoji(circle.purpose),
      name: circle.circleName,
      type: circle.circleType === "private" ? "Private Circle" : "Public Circle",
      members: circle.currentMembers,
      totalPool: `৳${circle.totalPool.toLocaleString()}`,
      nextPayout: circle.nextPayoutDate 
        ? new Date(circle.nextPayoutDate).toLocaleString('default', { month: 'short' })
        : "Not scheduled",
      color: getCircleColor(circle.purpose),
      ...circle,
    };

    return res.status(200).json({
      success: true,
      data: formattedCircle,
    });
  } catch (error) {
    console.error("Get circle by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch circle",
    });
  }
};

// Join a circle
export const joinCircle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

    const circlesCollection = db.collection("circles");
    const usersCollection = db.collection("users");

    const circle = await circlesCollection.findOne({
      _id: new ObjectId(id),
      status: "active",
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found or inactive",
      });
    }

    // Check if user is already a member
    const isMember = circle.members.some(
      member => member.userId.toString() === userId
    );

    if (isMember) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this circle",
      });
    }

    // Check if circle is full
    if (circle.currentMembers >= circle.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Circle is full",
      });
    }

    // Add user to circle
    const result = await circlesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: {
          members: {
            userId: new ObjectId(userId),
            joinedAt: new Date(),
            role: "member",
            totalDeposited: 0,
          },
        },
        $inc: { currentMembers: 1 },
        $set: { updatedAt: new Date() },
      }
    );

    // Add circle to user's circles array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          circles: {
            circleId: new ObjectId(id),
            circleName: circle.circleName,
            role: "member",
            joinedAt: new Date(),
          },
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Successfully joined the circle",
    });
  } catch (error) {
    console.error("Join circle error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to join circle",
    });
  }
};

// Leave a circle
export const leaveCircle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

    const circlesCollection = db.collection("circles");
    const usersCollection = db.collection("users");

    const circle = await circlesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found",
      });
    }

    // Check if user is the admin
    const userMember = circle.members.find(
      member => member.userId.toString() === userId
    );

    if (!userMember) {
      return res.status(400).json({
        success: false,
        message: "You are not a member of this circle",
      });
    }

    if (userMember.role === "admin" && circle.currentMembers > 1) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot leave the circle. Transfer admin role first or delete the circle.",
      });
    }

    // Remove user from circle
    await circlesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $pull: { members: { userId: new ObjectId(userId) } },
        $inc: { currentMembers: -1 },
        $set: { updatedAt: new Date() },
      }
    );

    // Remove circle from user's circles array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $pull: { circles: { circleId: new ObjectId(id) } },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Successfully left the circle",
    });
  } catch (error) {
    console.error("Leave circle error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to leave circle",
    });
  }
};

// Get public circles for discovery
export const getPublicCircles = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, purpose } = req.query;

    const circlesCollection = db.collection("circles");
    
    const query = { 
      circleType: "public",
      status: "active",
    };
    
    if (purpose && purpose !== "all") {
      query.purpose = purpose;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let circles = await circlesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    // Filter out circles where user is already a member
    circles = circles.filter(circle => 
      !circle.members.some(member => member.userId.toString() === userId)
    );

    const formattedCircles = circles.map(circle => ({
      _id: circle._id,
      emoji: getCircleEmoji(circle.purpose),
      name: circle.circleName,
      purpose: circle.purpose,
      members: circle.currentMembers,
      maxMembers: circle.maxMembers,
      totalPool: `৳${circle.totalPool.toLocaleString()}`,
      minDeposit: circle.minDeposit,
      targetAmount: circle.targetAmount,
      description: circle.description,
      circleType: circle.circleType,
      createdBy: circle.createdBy,
      createdAt: circle.createdAt,
    }));

    const total = await circlesCollection.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        circles: formattedCircles,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get public circles error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch public circles",
    });
  }
};

// Helper functions
function getCircleEmoji(purpose) {
  const emojiMap = {
    "wedding": "💍",
    "hajj": "🕌",
    "education": "🎓",
    "home": "🏠",
    "business": "💼",
    "emergency": "🆘",
    "travel": "✈️",
    "eid": "🌙",
    "general": "🤝",
  };
  return emojiMap[purpose?.toLowerCase()] || "🤝";
}

function getCircleColor(purpose) {
  const colorMap = {
    "wedding": "from-pink-500 to-rose-500",
    "hajj": "from-amber-500 to-orange-500",
    "education": "from-purple-500 to-indigo-500",
    "home": "from-emerald-500 to-teal-500",
    "business": "from-violet-500 to-purple-500",
    "emergency": "from-red-500 to-rose-500",
    "travel": "from-sky-500 to-blue-500",
    "eid": "from-green-500 to-emerald-500",
    "general": "from-primary to-primary-light",
  };
  return colorMap[purpose?.toLowerCase()] || "from-primary to-primary-light";
}


// Generate invite link for private circle
export const generateInviteLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

    const circlesCollection = db.collection("circles");

    const circle = await circlesCollection.findOne({
      _id: new ObjectId(id),
      "members.userId": new ObjectId(userId),
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found",
      });
    }

    // Check if user is admin
    const userMember = circle.members.find(
      member => member.userId.toString() === userId
    );

    if (userMember?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can generate invite links",
      });
    }

    // Generate unique invite code
    const inviteCode = generateInviteCode();
    const inviteExpiry = new Date();
    inviteExpiry.setDate(inviteExpiry.getDate() + 7); // 7 days expiry

    await circlesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          inviteCode,
          inviteExpiry,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        inviteCode,
        inviteLink: `${process.env.FRONTEND_URL}/dashboard/circles/join/${inviteCode}`,
        expiryDate: inviteExpiry,
      },
    });
  } catch (error) {
    console.error("Generate invite link error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate invite link",
    });
  }
};

// Join circle via invite code
export const joinCircleByInvite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { inviteCode } = req.params;

    const circlesCollection = db.collection("circles");
    const usersCollection = db.collection("users");

    const circle = await circlesCollection.findOne({
      inviteCode,
      status: "active",
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired invite link",
      });
    }

    // Check if invite is expired
    if (circle.inviteExpiry && new Date(circle.inviteExpiry) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invite link has expired",
      });
    }

    // Check if user is already a member
    const isMember = circle.members.some(
      member => member.userId.toString() === userId
    );

    if (isMember) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this circle",
      });
    }

    // Check if circle is full
    if (circle.currentMembers >= circle.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Circle is full",
      });
    }

    // Add user to circle
    await circlesCollection.updateOne(
      { _id: circle._id },
      {
        $push: {
          members: {
            userId: new ObjectId(userId),
            joinedAt: new Date(),
            role: "member",
            totalDeposited: 0,
          },
        },
        $inc: { currentMembers: 1 },
        $set: { updatedAt: new Date() },
      }
    );

    // Add circle to user's circles array
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          circles: {
            circleId: circle._id,
            circleName: circle.circleName,
            role: "member",
            joinedAt: new Date(),
          },
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Successfully joined the circle",
      data: { circleId: circle._id },
    });
  } catch (error) {
    console.error("Join circle by invite error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to join circle",
    });
  }
};

// Delete a circle (only admin)
export const deleteCircle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

    const circlesCollection = db.collection("circles");
    const usersCollection = db.collection("users");

    const circle = await circlesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found",
      });
    }

    // Check if user is admin
    const userMember = circle.members.find(
      member => member.userId.toString() === userId
    );

    if (!userMember || userMember.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete the circle",
      });
    }

    // Remove circle from all members' circles array
    const memberIds = circle.members.map(m => m.userId);
    
    for (const memberId of memberIds) {
      await usersCollection.updateOne(
        { _id: memberId },
        {
          $pull: { circles: { circleId: new ObjectId(id) } },
        }
      );
    }

    // Delete the circle
    await circlesCollection.deleteOne({ _id: new ObjectId(id) });

    return res.status(200).json({
      success: true,
      message: "Circle deleted successfully",
    });
  } catch (error) {
    console.error("Delete circle error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete circle",
    });
  }
};

// Helper function to generate invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}