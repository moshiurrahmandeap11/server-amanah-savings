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

    // Fetch user details for all members
    const userIds = circles.flatMap(c => (c.members || []).map(m => m.userId)).filter(Boolean);
    const usersCollection = db.collection("users");
    const users = userIds.length > 0 
      ? await usersCollection.find({ _id: { $in: userIds } }).project({ _id: 1, fullName: 1, firstName: 1, lastName: 1, phone: 1, email: 1 }).toArray()
      : [];
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

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
      membersList: (circle.members || []).map(m => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        totalDeposited: m.totalDeposited,
        user: userMap.get(m.userId.toString()) || null,
      })),
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

// Admin: get every circle with owner details
export const getAllCirclesAdmin = async (req, res) => {
  try {
    const {
      status,
      circleType,
      page = 1,
      limit = 50,
      search = "",
    } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (pageNumber - 1) * limitNumber;

    const circlesCollection = db.collection("circles");
    const match = {};

    if (status && status !== "all") {
      match.status = status;
    }

    if (circleType && circleType !== "all") {
      match.circleType = circleType;
    }

    if (search) {
      match.$or = [
        { circleName: { $regex: search, $options: "i" } },
        { purpose: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [circles, total] = await Promise.all([
      circlesCollection
        .aggregate([
          { $match: match },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limitNumber },
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "owner",
            },
          },
          { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "users",
              localField: "members.userId",
              foreignField: "_id",
              as: "memberUsers",
            },
          },
          {
            $project: {
              circleName: 1,
              purpose: 1,
              targetAmount: 1,
              maxMembers: 1,
              minDeposit: 1,
              description: 1,
              circleType: 1,
              createdBy: 1,
              currentMembers: 1,
              totalPool: 1,
              status: 1,
              createdAt: 1,
              updatedAt: 1,
              owner: {
                _id: "$owner._id",
                firstName: "$owner.firstName",
                lastName: "$owner.lastName",
                fullName: "$owner.fullName",
                phone: "$owner.phone",
                email: "$owner.email",
              },
              members: {
                $map: {
                  input: "$members",
                  as: "member",
                  in: {
                    userId: "$$member.userId",
                    role: "$$member.role",
                    joinedAt: "$$member.joinedAt",
                    totalDeposited: "$$member.totalDeposited",
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$memberUsers",
                            as: "u",
                            cond: { $eq: ["$$u._id", "$$member.userId"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                },
              },
            },
          },
        ])
        .toArray(),
      circlesCollection.countDocuments(match),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        circles,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalItems: total,
          itemsPerPage: limitNumber,
        },
      },
    });
  } catch (error) {
    console.error("Get all circles admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch admin circles",
    });
  }
};

// Admin: delete any circle
export const deleteCircleAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

    const circlesCollection = db.collection("circles");
    const usersCollection = db.collection("users");
    const joinRequestsCollection = db.collection("circleJoinRequests");
    const circleObjectId = new ObjectId(id);

    const circle = await circlesCollection.findOne({ _id: circleObjectId });
    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found",
      });
    }

    await Promise.all([
      circlesCollection.deleteOne({ _id: circleObjectId }),
      usersCollection.updateMany(
        {},
        { $pull: { circles: { circleId: circleObjectId } } }
      ),
      joinRequestsCollection.updateMany(
        { circleId: circleObjectId, status: "pending" },
        {
          $set: {
            status: "rejected",
            rejectionReason: "Circle deleted by admin",
            reviewedBy: new ObjectId(req.user._id),
            reviewedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: "Circle deleted successfully",
    });
  } catch (error) {
    console.error("Delete circle admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete circle",
    });
  }
};

// Get single circle by ID
export const getCircleById = async (req, res) => {
  try {
    const userId = req.user?._id;
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
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found",
      });
    }

    if (circle.circleType === "private") {
      if (!userId) {
        return res.status(403).json({
          success: false,
          message: "Private circle requires an invite or membership",
        });
      }

      const isMember = (circle.members || []).some(
        member => member.userId.toString() === String(userId)
      );

      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: "Private circle requires an invite or membership",
        });
      }
    }

    const isMember = userId ? (circle.members || []).some(
      member => member.userId.toString() === String(userId)
    ) : false;

    // Fetch user details for all members
    const userIds = (circle.members || []).map(m => m.userId).filter(Boolean);
    const usersCollection = db.collection("users");
    const users = userIds.length > 0 
      ? await usersCollection.find({ _id: { $in: userIds } }).project({ _id: 1, fullName: 1, firstName: 1, lastName: 1, phone: 1, email: 1 }).toArray()
      : [];
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

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
      isMember,
      membersList: (circle.members || []).map(m => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        totalDeposited: m.totalDeposited,
        user: userMap.get(m.userId.toString()) || null,
      })),
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
    const userObjectId = new ObjectId(userId);
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

    const circlesCollection = db.collection("circles");
    const usersCollection = db.collection("users");
    const joinRequestsCollection = db.collection("circleJoinRequests");

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

    if (circle.circleType === "private") {
      return res.status(403).json({
        success: false,
        message: "Private circles can only be joined with an invite link",
      });
    }

    // Check if user is already a member
    const isMember = (circle.members || []).some(
      member => member.userId.toString() === String(userId)
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

    const existingRequest = await joinRequestsCollection.findOne({
      circleId: new ObjectId(id),
      userId: userObjectId,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(200).json({
        success: true,
        message: "Your join request is already pending admin approval",
        data: {
          requestId: existingRequest._id,
          status: existingRequest.status,
        },
      });
    }

    const user = await usersCollection.findOne(
      { _id: userObjectId },
      { projection: { password: 0, pin: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const now = new Date();
    const request = {
      circleId: new ObjectId(id),
      circleName: circle.circleName,
      circleType: circle.circleType,
      userId: userObjectId,
      userName: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.phone || "User",
      userPhone: user.phone || null,
      userEmail: user.email || null,
      status: "pending",
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const result = await joinRequestsCollection.insertOne(request);

    return res.status(202).json({
      success: true,
      message: "Join request sent to admin for approval",
      data: {
        requestId: result.insertedId,
        status: request.status,
      },
    });
  } catch (error) {
    console.error("Join circle error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to join circle",
    });
  }
};

// Admin: list circle join requests
export const getCircleJoinRequestsAdmin = async (req, res) => {
  try {
    const {
      status = "pending",
      page = 1,
      limit = 20,
      search = "",
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;
    const joinRequestsCollection = db.collection("circleJoinRequests");

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { circleName: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
        { userPhone: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
      ];
    }

    const [requests, total] = await Promise.all([
      joinRequestsCollection
        .find(query)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .toArray(),
      joinRequestsCollection.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        requests,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber),
        },
      },
    });
  } catch (error) {
    console.error("Get circle join requests admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch circle join requests",
    });
  }
};

// Admin: approve or reject circle join request
export const reviewCircleJoinRequestAdmin = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const action = req.body.action || req.body.status;
    const normalizedAction = action === "approved"
      ? "approve"
      : action === "rejected"
        ? "reject"
        : action;

    if (!ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
    }

    if (!["approve", "reject"].includes(normalizedAction)) {
      return res.status(400).json({
        success: false,
        message: "Action must be approve or reject",
      });
    }

    const joinRequestsCollection = db.collection("circleJoinRequests");
    const circlesCollection = db.collection("circles");
    const usersCollection = db.collection("users");
    const now = new Date();

    const joinRequest = await joinRequestsCollection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    if (joinRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Join request is already ${joinRequest.status}`,
      });
    }

    if (normalizedAction === "reject") {
      await joinRequestsCollection.updateOne(
        { _id: joinRequest._id },
        {
          $set: {
            status: "rejected",
            rejectionReason: rejectionReason || null,
            reviewedBy: new ObjectId(req.user._id),
            reviewedAt: now,
            updatedAt: now,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Join request rejected",
      });
    }

    const circle = await circlesCollection.findOne({
      _id: joinRequest.circleId,
      status: "active",
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found or inactive",
      });
    }

    const isMember = (circle.members || []).some(
      member => member.userId.toString() === joinRequest.userId.toString()
    );

    if (isMember) {
      await joinRequestsCollection.updateOne(
        { _id: joinRequest._id },
        {
          $set: {
            status: "approved",
            reviewedBy: new ObjectId(req.user._id),
            reviewedAt: now,
            updatedAt: now,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "User is already a member of this circle",
      });
    }

    if (circle.currentMembers >= circle.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Circle is full",
      });
    }

    await circlesCollection.updateOne(
      { _id: circle._id },
      {
        $push: {
          members: {
            userId: joinRequest.userId,
            joinedAt: now,
            role: "member",
            totalDeposited: 0,
          },
        },
        $inc: { currentMembers: 1 },
        $set: { updatedAt: now },
      }
    );

    await usersCollection.updateOne(
      { _id: joinRequest.userId },
      {
        $push: {
          circles: {
            circleId: circle._id,
            circleName: circle.circleName,
            role: "member",
            joinedAt: now,
          },
        },
      }
    );

    await joinRequestsCollection.updateOne(
      { _id: joinRequest._id },
      {
        $set: {
          status: "approved",
          reviewedBy: new ObjectId(req.user._id),
          reviewedAt: now,
          updatedAt: now,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Join request approved and user added to circle",
    });
  } catch (error) {
    console.error("Review circle join request admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to review circle join request",
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
    const { page = 1, limit = 10, purpose } = req.query;

    const circlesCollection = db.collection("circles");
    const joinRequestsCollection = db.collection("circleJoinRequests");
    
    const query = { 
      circleType: { $ne: "private" },
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

    const userId = req.user?._id;
    const pendingRequestCircleIds = new Set();

    if (userId) {
      const pendingRequests = await joinRequestsCollection
        .find({
          userId: new ObjectId(userId),
          status: "pending",
        })
        .project({ circleId: 1 })
        .toArray();

      pendingRequests.forEach((request) => {
        if (request.circleId) {
          pendingRequestCircleIds.add(request.circleId.toString());
        }
      });
    }

    const formattedCircles = circles.map(circle => {
      const isMember = userId ? (circle.members || []).some(
        member => member.userId.toString() === String(userId)
      ) : false;
      const isPending = pendingRequestCircleIds.has(circle._id.toString());
      
      return {
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
        isMember,
        isPending,
      };
    });

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

// Update a circle (only admin can update)
export const updateCircle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const {
      circleName,
      purpose,
      targetAmount,
      maxMembers,
      minDeposit,
      description,
      circleType,
      status,
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

    const circlesCollection = db.collection("circles");
    const circle = await circlesCollection.findOne({ _id: new ObjectId(id) });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found",
      });
    }

    // Check if user is admin of this circle
    const userMember = circle.members.find(
      member => member.userId.toString() === userId
    );

    if (!userMember || userMember.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only circle admin can update this circle",
      });
    }

    // Build update object with only provided fields
    const updateData = { updatedAt: new Date() };
    if (circleName !== undefined) updateData.circleName = circleName;
    if (purpose !== undefined) updateData.purpose = purpose;
    if (targetAmount !== undefined) updateData.targetAmount = parseFloat(targetAmount);
    if (maxMembers !== undefined) updateData.maxMembers = parseInt(maxMembers);
    if (minDeposit !== undefined) updateData.minDeposit = parseFloat(minDeposit);
    if (description !== undefined) updateData.description = description || null;
    if (circleType !== undefined) updateData.circleType = circleType;
    if (status !== undefined) updateData.status = status;

    await circlesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated circle
    const updatedCircle = await circlesCollection.findOne({ _id: new ObjectId(id) });

    return res.status(200).json({
      success: true,
      message: "Circle updated successfully",
      data: updatedCircle,
    });
  } catch (error) {
    console.error("Update circle error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update circle",
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
// Admin: Withdraw from circle pool
export const withdrawFromCircle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { withdrawalAmount, paymentMethod, phoneNumber, bankName, accountNumber, accountHolderName } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid circle ID",
      });
    }

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
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      const phoneRegex = /^(0?1[3-9]\d{8})$/;
      if (!phoneRegex.test(cleanedPhone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format. Must be 11 digits starting with 01 or 1",
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

    const circlesCollection = db.collection("circles");
    const withdrawalsCollection = db.collection("withdrawals");

    const circle = await circlesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!circle) {
      return res.status(404).json({
        success: false,
        message: "Circle not found",
      });
    }

    // Check if user is admin of this circle
    const userMember = circle.members.find(
      member => member.userId.toString() === userId
    );

    if (!userMember || userMember.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only circle admin can withdraw from the pool",
      });
    }

    const totalPool = Number(circle.totalPool) || 0;
    const withdrawalAmountNum = parseFloat(withdrawalAmount);

    if (withdrawalAmountNum > totalPool) {
      return res.status(400).json({
        success: false,
        message: `Insufficient pool balance. Available: ৳${totalPool.toLocaleString()}, Requested: ৳${withdrawalAmountNum.toLocaleString()}`,
        data: { availableBalance: totalPool, requestedAmount: withdrawalAmountNum },
      });
    }

    // Check for pending circle withdrawal
    const existingPending = await withdrawalsCollection.findOne({
      circleId: new ObjectId(id),
      status: "pending",
      isCircleWithdrawal: true,
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending withdrawal request for this circle",
      });
    }

    // Create withdrawal object
    const newWithdrawal = {
      userId: new ObjectId(userId),
      circleId: new ObjectId(id),
      circleName: circle.circleName,
      goalId: null,
      goalName: circle.circleName,
      goalType: "circle",
      withdrawalAmount: withdrawalAmountNum,
      reason: "Circle pool withdrawal by admin",
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
      isCircleWithdrawal: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await withdrawalsCollection.insertOne(newWithdrawal);
    const withdrawal = { ...newWithdrawal, _id: result.insertedId };

    return res.status(201).json({
      success: true,
      message: "Circle withdrawal request submitted successfully. Admin will review within 5-7 working days.",
      data: {
        withdrawal,
        availablePool: totalPool - withdrawalAmountNum,
      },
    });
  } catch (error) {
    console.error("Circle withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit circle withdrawal request",
    });
  }
};
