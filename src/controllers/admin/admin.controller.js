import { ObjectId } from "mongodb";
import { db } from "../../database/db.js";

// ==================== GET ALL USERS (ADMIN) ====================
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      plan = "",
      kycStatus = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;
    const usersCollection = db.collection("users");
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    const filter = {};
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { referralCode: { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      if (status === "active") filter.accountActive = true;
      else if (status === "inactive") filter.accountActive = false;
      else if (status === "banned") filter.isBanned = true;
      else if (status === "suspended") filter.isSuspended = true;
    }
    if (plan) filter.selectedPlan = plan;
    if (kycStatus) filter["kyc.status"] = kycStatus;
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    const [users, total] = await Promise.all([
      usersCollection
        .find(filter, { projection: { password: 0, pin: 0 } })
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      usersCollection.countDocuments(filter),
    ]);
    const formattedUsers = users.map((user) => ({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName:
        user.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      phone: user.phone,
      email: user.email,
      role: user.role,
      selectedPlan: user.selectedPlan,
      level: user.level,
      totalSaved: user.totalSaved || 0,
      totalDeposits: user.totalDeposits || 0,
      totalWithdrawals: user.totalWithdrawals || 0,
      accountActive: user.accountActive || false,
      kycStatus: user.kyc?.status || "pending",
      kycCompleted: user.kycCompleted || false,
      isBanned: user.isBanned || false,
      isSuspended: user.isSuspended || false,
      suspensionReason: user.suspensionReason || null,
      banReason: user.banReason || null,
      profilePicture: user.profilePicture,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      division: user.division,
      district: user.district,
      occupation: user.occupation,
      income: user.income,
    }));
    return res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch users",
      });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, pin: 0 } },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const deposits = await db
      .collection("deposits")
      .find({ userId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const withdrawals = await db
      .collection("withdrawals")
      .find({ userId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const goals = await db
      .collection("goals")
      .find({ userId: new ObjectId(id) })
      .toArray();

    const loginHistory = await db
      .collection("login_history")
      .find({ userId: new ObjectId(id) })
      .sort({ loginTime: -1 })
      .limit(10)
      .toArray();

    return res.status(200).json({
      success: true,
      data: {
        user: { id: user._id, ...user },
        deposits: deposits.map((d) => ({
          id: d._id,
          amount: d.depositAmount, // ✅ fixed
          status: d.status,
          method: d.paymentMethod, // ✅ fixed
          goalName: d.goalName,
          createdAt: d.createdAt,
        })),
        withdrawals: withdrawals.map((w) => ({
          id: w._id,
          amount: w.withdrawalAmount, // ✅ fixed
          status: w.status,
          method: w.paymentMethod, // ✅ fixed
          goalName: w.goalName,
          createdAt: w.createdAt,
        })),
        goals: goals.map((g) => ({
          id: g._id,
          title: g.goalName, // ✅ fixed
          targetAmount: g.targetAmount,
          currentAmount: g.currentSaved, // ✅ fixed
          status: g.status,
        })),
        loginHistory: loginHistory.map((h) => ({
          id: h._id,
          success: h.success,
          ip: h.ip,
          device: h.device,
          location: h.location,
          loginTime: h.loginTime,
        })),
      },
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch user details",
      });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      accountActive,
      isBanned,
      isSuspended,
      suspensionReason,
      banReason,
    } = req.body;
    const usersCollection = db.collection("users");
    const updateData = { updatedAt: new Date() };
    if (typeof accountActive === "boolean")
      updateData.accountActive = accountActive;
    if (typeof isBanned === "boolean") {
      updateData.isBanned = isBanned;
      updateData.banReason = isBanned ? banReason : null;
    }
    if (typeof isSuspended === "boolean") {
      updateData.isSuspended = isSuspended;
      updateData.suspensionReason = isSuspended ? suspensionReason : null;
    }
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData },
    );
    if (result.matchedCount === 0)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    return res
      .status(200)
      .json({ success: true, message: "User status updated successfully" });
  } catch (error) {
    console.error("Update user status error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to update user status",
      });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!role || !["user", "admin"].includes(role))
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid role. Must be 'user' or 'admin'",
        });
    const usersCollection = db.collection("users");
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    return res
      .status(200)
      .json({ success: true, message: `User role updated to ${role}` });
  } catch (error) {
    console.error("Update user role error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to update user role",
      });
  }
};

export const updateKycStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    if (!status || !["pending", "approved", "rejected"].includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid KYC status" });
    const usersCollection = db.collection("users");
    const updateData = {
      "kyc.status": status,
      "kyc.verifiedAt": status === "approved" ? new Date() : null,
      "kyc.rejectionReason": status === "rejected" ? rejectionReason : null,
      kycCompleted: status === "approved",
      updatedAt: new Date(),
    };
    if (status === "approved") updateData.accountActive = true;
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData },
    );
    if (result.matchedCount === 0)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    return res
      .status(200)
      .json({ success: true, message: `KYC ${status} successfully` });
  } catch (error) {
    console.error("Update KYC status error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to update KYC status",
      });
  }
};

export const getKycApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "", search = "" } = req.query;
    const usersCollection = db.collection("users");
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    // Build filter conditions
    const conditions = [];
    
    // Condition 1: User has KYC status (pending/approved/rejected) OR has KYC documents uploaded
    const kycConditions = [
      { "kyc.status": { $in: ["pending", "approved", "rejected"] } },
      { "kyc.nidFrontImage": { $exists: true, $ne: null, $ne: "" } },
      { "kyc.nidBackImage": { $exists: true, $ne: null, $ne: "" } },
      { "kyc.selfieImage": { $exists: true, $ne: null, $ne: "" } },
      { "kyc.birthCertificateImage": { $exists: true, $ne: null, $ne: "" } },
      { "kyc.passportImage": { $exists: true, $ne: null, $ne: "" } },
    ];
    conditions.push({ $or: kycConditions });
    
    // Condition 2: Exclude users who skipped KYC and have NO documents at all
    conditions.push({
      $not: {
        $and: [
          { "kyc.status": "skipped" },
          { "kyc.nidFrontImage": { $in: [null, ""], $exists: true } },
          { "kyc.nidBackImage": { $in: [null, ""], $exists: true } },
          { "kyc.selfieImage": { $in: [null, ""], $exists: true } },
          { "kyc.birthCertificateImage": { $in: [null, ""], $exists: true } },
          { "kyc.passportImage": { $in: [null, ""], $exists: true } },
        ]
      }
    });
    
    // Condition 3: Status filter (if provided)
    if (status) {
      conditions.push({ "kyc.status": status });
    }
    
    // Condition 4: Search filter (if provided) - combines with $and so KYC conditions are preserved
    if (search) {
      const searchConditions = [
        { fullName: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { "kyc.nidNumber": { $regex: search, $options: "i" } },
      ];
      conditions.push({ $or: searchConditions });
    }
    
    // Combine all conditions with $and
    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };
    
    console.log("[KYC API] Filter:", JSON.stringify(filter, null, 2));
    const [users, total] = await Promise.all([
      usersCollection
        .find(filter, { projection: { password: 0, pin: 0 } })
        .sort({ "kyc.submittedAt": -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      usersCollection.countDocuments(filter),
    ]);
    
    // Debug log
    console.log(`[KYC API] Found ${users.length} users, total: ${total}`);
    console.log(`[KYC API] Filter used: ${JSON.stringify(filter).substring(0, 500)}`);
    if (users.length > 0) {
      const firstUser = users[0];
      console.log(`[KYC API] First user KYC data:`, {
        id: firstUser._id,
        nidNumber: firstUser.kyc?.nidNumber,
        nidFrontImage: firstUser.kyc?.nidFrontImage ? "PRESENT (" + firstUser.kyc.nidFrontImage.substring(0, 50) + "...)" : "NULL",
        nidBackImage: firstUser.kyc?.nidBackImage ? "PRESENT" : "NULL",
        selfieImage: firstUser.kyc?.selfieImage ? "PRESENT" : "NULL",
        birthCertificateImage: firstUser.kyc?.birthCertificateImage ? "PRESENT" : "NULL",
        passportImage: firstUser.kyc?.passportImage ? "PRESENT" : "NULL",
        kycStatus: firstUser.kyc?.status,
      });
    }
    
    const formattedApplications = users.map((user) => ({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName:
        user.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      phone: user.phone,
      email: user.email,
      nidNumber: user.kyc?.nidNumber || null,
      kycStatus: user.kyc?.status || "pending",
      kycSubmittedAt: user.kyc?.submittedAt,
      kycVerifiedAt: user.kyc?.verifiedAt,
      kycRejectionReason: user.kyc?.rejectionReason,
      islamicMode: user.kyc?.islamicMode || false,
      kycConsent: user.kyc?.kycConsent || false,
      accountActive: user.accountActive || false,
      selectedPlan: user.selectedPlan,
      profilePicture: user.profilePicture,
      division: user.division,
      district: user.district,
      upazila: user.upazila,
      village: user.village,
      postOffice: user.postOffice,
      postCode: user.postCode,
      occupation: user.occupation,
      income: user.income,
      dob: user.dob,
      gender: user.gender,
      createdAt: user.createdAt,
      // KYC Document URLs - check both nested kyc object and root level (fallback)
      nidFrontUrl: user.kyc?.nidFrontImage || user.nidFrontImage || null,
      nidBackUrl: user.kyc?.nidBackImage || user.nidBackImage || null,
      selfieUrl: user.kyc?.selfieImage || user.selfieImage || null,
      birthCertificateUrl: user.kyc?.birthCertificateImage || user.birthCertificateImage || null,
      passportUrl: user.kyc?.passportImage || user.passportImage || null,
      // Nominee info
      nominee: user.nominee || null,
      // Payment info
      paymentMethod: user.paymentMethod,
      paymentDetails: user.paymentDetails || null,
    }));
    return res.status(200).json({
      success: true,
      data: {
        applications: formattedApplications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get KYC applications error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch KYC applications",
      });
  }
};

export const getAdminDashboardStats = async (req, res) => {
  try {
    const { range = "30d" } = req.query;
    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");
    const withdrawalsCollection = db.collection("withdrawals");

    const now = new Date();
    let startDate = new Date();
    switch (range) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalUsers,
      activeUsers,
      pendingKyc,
      pendingDeposits,
      pendingWithdrawals,
      totalDepositsAmount,
      totalWithdrawalsAmount,
      todayDeposits,
      todayWithdrawals,
      monthDeposits,
      monthWithdrawals,
      bannedUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
    ] = await Promise.all([
      usersCollection.countDocuments(),
      usersCollection.countDocuments({ accountActive: true }),
      usersCollection.countDocuments({ "kyc.status": "pending" }),
      depositsCollection.countDocuments({ status: "pending" }),
      withdrawalsCollection.countDocuments({ status: "pending" }),
      // ✅ depositAmount
      depositsCollection
        .aggregate([
          { $match: { status: "approved" } },
          { $group: { _id: null, total: { $sum: "$depositAmount" } } },
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      // ✅ withdrawalAmount
      withdrawalsCollection
        .aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$withdrawalAmount" } } },
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      depositsCollection.countDocuments({
        status: "approved",
        createdAt: { $gte: today },
      }),
      withdrawalsCollection.countDocuments({
        status: "completed",
        createdAt: { $gte: today },
      }),
      depositsCollection
        .aggregate([
          { $match: { status: "approved", createdAt: { $gte: thisMonth } } },
          { $group: { _id: null, total: { $sum: "$depositAmount" } } }, // ✅
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      withdrawalsCollection
        .aggregate([
          { $match: { status: "completed", createdAt: { $gte: thisMonth } } },
          { $group: { _id: null, total: { $sum: "$withdrawalAmount" } } }, // ✅
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      usersCollection.countDocuments({ isBanned: true }),
      usersCollection.countDocuments({ createdAt: { $gte: today } }),
      usersCollection.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      usersCollection.countDocuments({ createdAt: { $gte: thisMonth } }),
    ]);

    let rangeDeposits = 0,
      rangeWithdrawals = 0,
      rangeNewUsers = 0;
    if (req.query.export === "true") {
      rangeDeposits = await depositsCollection
        .aggregate([
          { $match: { status: "approved", createdAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: "$depositAmount" } } }, // ✅
        ])
        .toArray()
        .then((r) => r[0]?.total || 0);

      rangeWithdrawals = await withdrawalsCollection
        .aggregate([
          { $match: { status: "completed", createdAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: "$withdrawalAmount" } } }, // ✅
        ])
        .toArray()
        .then((r) => r[0]?.total || 0);

      rangeNewUsers = await usersCollection.countDocuments({
        createdAt: { $gte: startDate },
      });
    }

    const recentUsers = await usersCollection
      .find({}, { projection: { password: 0, pin: 0 } })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const recentDeposits = await depositsCollection
      .find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const recentWithdrawals = await withdrawalsCollection
      .find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          pendingKyc,
          pendingDeposits,
          pendingWithdrawals,
          totalDepositsAmount,
          totalWithdrawalsAmount,
          todayDeposits,
          todayWithdrawals,
          monthDeposits,
          monthWithdrawals,
          bannedUsers,
          newUsersToday,
          newUsersThisWeek,
          newUsersThisMonth,
          ...(req.query.export === "true" && {
            rangeDeposits,
            rangeWithdrawals,
            rangeNewUsers,
          }),
        },
        recent: {
          users: recentUsers.map((u) => ({
            id: u._id,
            name:
              u.fullName || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
            phone: u.phone,
            plan: u.selectedPlan,
            kycStatus: u.kyc?.status || "pending",
            createdAt: u.createdAt,
          })),
          deposits: recentDeposits.map((d) => ({
            id: d._id,
            userId: d.userId,
            amount: d.depositAmount, // ✅
            method: d.paymentMethod, // ✅
            goalName: d.goalName,
            status: d.status,
            createdAt: d.createdAt,
          })),
          withdrawals: recentWithdrawals.map((w) => ({
            id: w._id,
            userId: w.userId,
            amount: w.withdrawalAmount, // ✅
            method: w.paymentMethod, // ✅
            goalName: w.goalName,
            status: w.status,
            createdAt: w.createdAt,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Get admin dashboard stats error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch dashboard stats",
      });
  }
};

// ==================== ADMIN SUPPORT TICKETS ====================
export const getAllSupportTicketsAdmin = async (req, res) => {
  try {
    const {
      status,
      priority,
      category,
      search,
      page = 1,
      limit = 20,
    } = req.query;
    const ticketsCollection = db.collection("support_tickets");
    const repliesCollection = db.collection("ticket_replies");
    const query = {};
    if (status && status !== "all") query.status = status;
    if (priority && priority !== "all") query.priority = priority;
    if (category && category !== "all") query.category = category;
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { ticketId: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    const [tickets, total] = await Promise.all([
      ticketsCollection
        .aggregate([
          { $match: query },
          { $sort: { priority: 1, createdAt: -1 } },
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
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              ticketId: 1,
              subject: 1,
              message: 1,
              category: 1,
              priority: 1,
              status: 1,
              attachments: 1,
              createdAt: 1,
              updatedAt: 1,
              resolvedAt: 1,
              adminNote: 1,
              "user.fullName": 1,
              "user.firstName": 1,
              "user.lastName": 1,
              "user.phone": 1,
              "user.email": 1,
              "user.profilePicture": 1,
            },
          },
        ])
        .toArray(),
      ticketsCollection.countDocuments(query),
    ]);

    const ticketIds = tickets.map((t) => t.ticketId);
    const replyCounts = await repliesCollection
      .aggregate([
        { $match: { ticketId: { $in: ticketIds } } },
        { $group: { _id: "$ticketId", count: { $sum: 1 } } },
      ])
      .toArray();
    const replyCountMap = Object.fromEntries(
      replyCounts.map((r) => [r._id, r.count]),
    );

    const stats = await ticketsCollection
      .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
      .toArray();
    const statsMap = Object.fromEntries(stats.map((s) => [s._id, s.count]));

    const urgentCount = await ticketsCollection.countDocuments({
      priority: "urgent",
      status: { $nin: ["resolved", "closed"] },
    });

    const formattedTickets = tickets.map((t) => ({
      id: t._id,
      ticketId: t.ticketId,
      subject: t.subject,
      message: t.message,
      category: t.category,
      priority: t.priority,
      status: t.status,
      replyCount: replyCountMap[t.ticketId] || 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolvedAt: t.resolvedAt,
      adminNote: t.adminNote,
      user: t.user
        ? {
            id: t.user._id,
            fullName:
              t.user.fullName ||
              `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim(),
            phone: t.user.phone,
            email: t.user.email,
            profilePicture: t.user.profilePicture,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        tickets: formattedTickets,
        statistics: {
          open: statsMap.open || 0,
          inProgress: statsMap.in_progress || 0,
          resolved: statsMap.resolved || 0,
          closed: statsMap.closed || 0,
          urgent: urgentCount,
          total,
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
    console.error("Get all tickets admin error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch tickets",
      });
  }
};

export const adminReplyToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, isInternal = false } = req.body;
    const adminId = req.user._id || req.user.id;
    if (!message)
      return res
        .status(400)
        .json({ success: false, message: "Message is required" });

    const ticketsCollection = db.collection("support_tickets");
    const repliesCollection = db.collection("ticket_replies");
    const ticket = await ticketsCollection.findOne({ ticketId });
    if (!ticket)
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });

    const reply = {
      ticketId,
      userId: new ObjectId(adminId),
      message,
      isAdmin: true,
      isInternal,
      createdAt: new Date(),
    };
    await repliesCollection.insertOne(reply);
    await ticketsCollection.updateOne(
      { ticketId },
      {
        $set: {
          status: isInternal ? ticket.status : "in_progress",
          updatedAt: new Date(),
        },
      },
    );

    const { emitTicketReply } = await import("../socket/socket.js");
    if (ticket.userId) {
      emitTicketReply(ticket.userId.toString(), ticketId, {
        message,
        isAdmin: true,
        createdAt: new Date(),
      });
    }

    return res
      .status(200)
      .json({
        success: true,
        message: "Reply added successfully",
        data: reply,
      });
  } catch (error) {
    console.error("Admin reply to ticket error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to add reply",
      });
  }
};

export const getTicketWithRepliesAdmin = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticketsCollection = db.collection("support_tickets");
    const repliesCollection = db.collection("ticket_replies");
    const ticket = await ticketsCollection.findOne({ ticketId });
    if (!ticket)
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });

    const usersCollection = db.collection("users");
    const user = ticket.userId
      ? await usersCollection.findOne(
          { _id: new ObjectId(ticket.userId) },
          { projection: { password: 0, pin: 0 } },
        )
      : null;

    const replies = await repliesCollection
      .aggregate([
        { $match: { ticketId } },
        { $sort: { createdAt: 1 } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            message: 1,
            isAdmin: 1,
            isInternal: 1,
            createdAt: 1,
            "user.fullName": 1,
            "user.firstName": 1,
            "user.profilePicture": 1,
          },
        },
      ])
      .toArray();

    return res.status(200).json({
      success: true,
      data: {
        ticket: {
          ...ticket,
          user: user
            ? {
                id: user._id,
                fullName:
                  user.fullName ||
                  `${user.firstName || ""} ${user.lastName || ""}`.trim(),
                phone: user.phone,
                email: user.email,
                profilePicture: user.profilePicture,
              }
            : null,
        },
        replies: replies.map((r) => ({
          id: r._id,
          message: r.message,
          isAdmin: r.isAdmin,
          isInternal: r.isInternal,
          createdAt: r.createdAt,
          user: r.user
            ? {
                fullName: r.user.fullName || `${r.user.firstName || ""}`.trim(),
                profilePicture: r.user.profilePicture,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error("Get ticket with replies admin error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch ticket details",
      });
  }
};

// ==================== ADMIN NOTIFICATIONS ====================
export const sendBulkNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type = "system",
      audience = "all",
      plan,
      sendVia = ["inApp"],
      scheduledAt,
    } = req.body;
    if (!title || !message)
      return res
        .status(400)
        .json({ success: false, message: "Title and message are required" });

    const usersCollection = db.collection("users");
    const notificationsCollection = db.collection("notifications");
    const notificationLogsCollection = db.collection("notification_logs");

    const userFilter = {};
    if (audience === "active") userFilter.accountActive = true;
    else if (audience === "inactive") userFilter.accountActive = false;
    else if (audience === "pending_kyc") userFilter["kyc.status"] = "pending";
    if (plan) userFilter.selectedPlan = plan;

    const users = await usersCollection
      .find(userFilter, { projection: { _id: 1 } })
      .toArray();
    const userIds = users.map((u) => u._id);

    const notifications = userIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      icon: getIconForType(type),
      badge: getBadgeForType(type),
      read: false,
      sendVia,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      sentAt: scheduledAt ? null : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const BATCH_SIZE = 500;
    let insertedCount = 0;
    for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
      const batch = notifications.slice(i, i + BATCH_SIZE);
      const result = await notificationsCollection.insertMany(batch);
      insertedCount += result.insertedCount;
    }

    await notificationLogsCollection.insertOne({
      title,
      message,
      type,
      audience,
      plan,
      sendVia,
      recipientCount: userIds.length,
      sentCount: insertedCount,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      sentAt: scheduledAt ? null : new Date(),
      sentBy: req.user._id || req.user.id,
      createdAt: new Date(),
    });

    const { emitUserNotification } = await import("../socket/socket.js");
    for (const userId of userIds) {
      emitUserNotification(userId.toString(), {
        type,
        title,
        message,
        createdAt: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: `Notification sent to ${insertedCount} users`,
      data: { recipientCount: userIds.length, sentCount: insertedCount },
    });
  } catch (error) {
    console.error("Send bulk notification error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to send notification",
      });
  }
};

export const getNotificationLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const notificationLogsCollection = db.collection("notification_logs");
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    const [logs, total] = await Promise.all([
      notificationLogsCollection
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      notificationLogsCollection.countDocuments(),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        logs: logs.map((l) => ({
          id: l._id,
          title: l.title,
          type: l.type,
          audience: l.audience,
          recipientCount: l.recipientCount,
          sentCount: l.sentCount,
          scheduledAt: l.scheduledAt,
          sentAt: l.sentAt,
          createdAt: l.createdAt,
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get notification logs error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch notification logs",
      });
  }
};

// ==================== ADMIN REPORTS & ANALYTICS ====================
export const getReportsData = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");
    const withdrawalsCollection = db.collection("withdrawals");
    const goalsCollection = db.collection("goals");
    const ticketsCollection = db.collection("support_tickets");

    const now = new Date();
    let startDate = new Date();
    if (period === "7d") startDate.setDate(now.getDate() - 7);
    else if (period === "30d") startDate.setDate(now.getDate() - 30);
    else if (period === "3m") startDate.setMonth(now.getMonth() - 3);
    else if (period === "1y") startDate.setFullYear(now.getFullYear() - 1);

    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalDeposits,
      totalDepositsAmount,
      periodDeposits,
      periodDepositsAmount,
      totalWithdrawals,
      totalWithdrawalsAmount,
      periodWithdrawals,
      periodWithdrawalsAmount,
      totalGoals,
      activeGoals,
      kycCompleted,
      totalTickets,
      resolvedTickets,
    ] = await Promise.all([
      usersCollection.countDocuments(),
      usersCollection.countDocuments({ accountActive: true }),
      usersCollection.countDocuments({ createdAt: { $gte: startDate } }),
      depositsCollection.countDocuments(),
      // ✅ depositAmount
      depositsCollection
        .aggregate([
          { $match: { status: "approved" } },
          { $group: { _id: null, total: { $sum: "$depositAmount" } } },
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      depositsCollection.countDocuments({ createdAt: { $gte: startDate } }),
      depositsCollection
        .aggregate([
          { $match: { status: "approved", createdAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: "$depositAmount" } } }, // ✅
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      withdrawalsCollection.countDocuments(),
      // ✅ withdrawalAmount
      withdrawalsCollection
        .aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$withdrawalAmount" } } },
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      withdrawalsCollection.countDocuments({ createdAt: { $gte: startDate } }),
      withdrawalsCollection
        .aggregate([
          { $match: { status: "completed", createdAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: "$withdrawalAmount" } } }, // ✅
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      goalsCollection.countDocuments(),
      goalsCollection.countDocuments({ status: "active" }),
      usersCollection.countDocuments({ kycCompleted: true }),
      ticketsCollection.countDocuments(),
      ticketsCollection.countDocuments({ status: "resolved" }),
    ]);

    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
      );
      const monthLabel = monthStart.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      const [deposits, withdrawals] = await Promise.all([
        depositsCollection
          .aggregate([
            {
              $match: {
                status: "approved",
                createdAt: { $gte: monthStart, $lte: monthEnd },
              },
            },
            { $group: { _id: null, total: { $sum: "$depositAmount" } } }, // ✅
          ])
          .toArray()
          .then((r) => r[0]?.total || 0),
        withdrawalsCollection
          .aggregate([
            {
              $match: {
                status: "completed",
                createdAt: { $gte: monthStart, $lte: monthEnd },
              },
            },
            { $group: { _id: null, total: { $sum: "$withdrawalAmount" } } }, // ✅
          ])
          .toArray()
          .then((r) => r[0]?.total || 0),
      ]);
      monthlyTrends.push({ month: monthLabel, deposits, withdrawals });
    }

    // ✅ goalType & currentSaved
    const goalCategories = await goalsCollection
      .aggregate([
        { $match: {} },
        {
          $group: {
            _id: { $ifNull: ["$goalType", "Other"] },
            count: { $sum: 1 },
            totalAmount: { $sum: "$targetAmount" },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();
    const totalGoalsCount =
      goalCategories.reduce((sum, g) => sum + g.count, 0) || 1;
    const formattedGoalCategories = goalCategories.map((g) => ({
      name: g._id || "Other",
      count: g.count,
      percentage: Math.round((g.count / totalGoalsCount) * 100),
      totalAmount: g.totalAmount,
    }));

    // ✅ depositAmount for topSavers
    const topSavers = await depositsCollection
      .aggregate([
        { $match: { status: "approved" } },
        {
          $group: {
            _id: "$userId",
            totalSaved: { $sum: "$depositAmount" }, // ✅
            depositCount: { $sum: 1 },
          },
        },
        { $sort: { totalSaved: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            totalSaved: 1,
            depositCount: 1,
            "user.fullName": 1,
            "user.firstName": 1,
            "user.lastName": 1,
            "user.profilePicture": 1,
            "user.streak": 1,
            "user.level": 1,
          },
        },
      ])
      .toArray();

    return res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalUsers,
          activeUsers,
          newUsers,
          totalDeposits,
          totalDepositsAmount,
          totalWithdrawals,
          totalWithdrawalsAmount,
          totalGoals,
          activeGoals,
          kycRate:
            totalUsers > 0 ? ((kycCompleted / totalUsers) * 100).toFixed(1) : 0,
          totalTickets,
          resolvedTickets,
          netSavings: totalDepositsAmount - totalWithdrawalsAmount,
        },
        periodStats: {
          deposits: periodDeposits,
          depositsAmount: periodDepositsAmount,
          withdrawals: periodWithdrawals,
          withdrawalsAmount: periodWithdrawalsAmount,
          newUsers,
        },
        monthlyTrends,
        goalCategories: formattedGoalCategories,
        topSavers: topSavers.map((s, i) => ({
          rank: i + 1,
          name:
            s.user?.fullName ||
            `${s.user?.firstName || ""} ${s.user?.lastName || ""}`.trim() ||
            "Unknown",
          totalSaved: s.totalSaved,
          depositCount: s.depositCount,
          streak: s.user?.streak || 0,
          level: s.user?.level || 1,
          profilePicture: s.user?.profilePicture,
        })),
      },
    });
  } catch (error) {
    console.error("Get reports data error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch reports data",
      });
  }
};

export const getAnalyticsData = async (req, res) => {
  try {
    const usersCollection = db.collection("users");
    const loginHistoryCollection = db.collection("login_history");
    const now = new Date();
    const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const dauData = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const count = await loginHistoryCollection.countDocuments({
        loginTime: { $gte: day, $lt: nextDay },
        success: true,
      });
      dauData.push({
        date: day.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        users: count,
      });
    }

    const deviceStats = await loginHistoryCollection
      .aggregate([
        { $match: { loginTime: { $gte: last14Days }, success: true } },
        { $group: { _id: "$device", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();
    const totalDeviceLogins =
      deviceStats.reduce((sum, d) => sum + d.count, 0) || 1;
    const deviceBreakdown = deviceStats.map((d) => ({
      name: d._id || "Unknown",
      count: d.count,
      percentage: Math.round((d.count / totalDeviceLogins) * 100),
    }));

    const divisionStats = await usersCollection
      .aggregate([
        { $match: { division: { $exists: true, $ne: null } } },
        { $group: { _id: "$division", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();
    const totalDivisions =
      divisionStats.reduce((sum, d) => sum + d.count, 0) || 1;
    const divisionBreakdown = divisionStats.map((d) => ({
      name: d._id,
      count: d.count,
      percentage: Math.round((d.count / totalDivisions) * 100),
    }));

    const avgSession = await loginHistoryCollection
      .aggregate([
        { $match: { loginTime: { $gte: last14Days }, success: true } },
        {
          $group: {
            _id: "$userId",
            sessions: { $sum: 1 },
            lastLogin: { $max: "$loginTime" },
          },
        },
        {
          $group: {
            _id: null,
            avgSessions: { $avg: "$sessions" },
            totalUsers: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [activeLast7Days, totalActiveUsers] = await Promise.all([
      loginHistoryCollection
        .aggregate([
          { $match: { loginTime: { $gte: last7Days }, success: true } },
          { $group: { _id: "$userId" } },
          { $count: "count" },
        ])
        .toArray()
        .then((r) => r[0]?.count || 0),
      usersCollection.countDocuments({ accountActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        dau: dauData,
        deviceBreakdown,
        divisionBreakdown,
        sessionStats: {
          avgSessionsPerUser: Math.round(avgSession[0]?.avgSessions || 0),
          activeUsersLast7Days: activeLast7Days,
          retentionRate:
            totalActiveUsers > 0
              ? Math.round((activeLast7Days / totalActiveUsers) * 100)
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("Get analytics data error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch analytics data",
      });
  }
};

// ==================== ADMIN SAVINGS & REVENUE ====================
export const getSavingsData = async (req, res) => {
  try {
    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");
    const goalsCollection = db.collection("goals");
    const circlesCollection = db.collection("circles");

    const [
      totalUsers,
      activeUsers,
      totalDepositsAmount,
      totalWithdrawalsAmount,
      totalGoals,
      activeGoals,
      totalCircles,
      activeCircles,
    ] = await Promise.all([
      usersCollection.countDocuments(),
      usersCollection.countDocuments({ accountActive: true }),
      // ✅ depositAmount
      depositsCollection
        .aggregate([
          { $match: { status: "approved" } },
          { $group: { _id: null, total: { $sum: "$depositAmount" } } },
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      // ✅ withdrawalAmount
      db
        .collection("withdrawals")
        .aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$withdrawalAmount" } } },
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      goalsCollection.countDocuments(),
      goalsCollection.countDocuments({ status: "active" }),
      circlesCollection.countDocuments(),
      circlesCollection.countDocuments({ status: "active" }),
    ]);

    // ✅ goalType, currentSaved, monthlyDeposit
    const goalsByType = await goalsCollection
      .aggregate([
        { $match: {} },
        {
          $group: {
            _id: { $ifNull: ["$goalType", "Other"] },
            count: { $sum: 1 },
            totalTarget: { $sum: "$targetAmount" },
            totalCurrent: { $sum: "$currentSaved" },
            totalMonthly: { $sum: "$monthlyDeposit" },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const totalGoalsByType =
      goalsByType.reduce((sum, g) => sum + g.count, 0) || 1;
    const formattedGoalsByType = goalsByType.map((g) => ({
      name: g._id || "Other",
      count: g.count,
      percentage: Math.round((g.count / totalGoalsByType) * 100),
      totalTarget: g.totalTarget || 0,
      totalCurrent: g.totalCurrent || 0,
      avgMonthly: g.count > 0 ? Math.round(g.totalMonthly / g.count) : 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalSavingsPool: totalDepositsAmount - totalWithdrawalsAmount,
          totalDepositsAmount,
          totalWithdrawalsAmount,
          totalUsers,
          activeUsers,
          totalGoals,
          activeGoals,
          totalCircles,
          activeCircles,
          retentionRate:
            totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
        },
        goalsByType: formattedGoalsByType,
      },
    });
  } catch (error) {
    console.error("Get savings data error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch savings data",
      });
  }
};

export const getRevenueData = async (req, res) => {
  try {
    const depositsCollection = db.collection("deposits");
    const usersCollection = db.collection("users");
    const now = new Date();
    const months = [];

    for (let i = 4; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
      );
      const label = monthStart.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      const [deposits, depositCount, newUsers] = await Promise.all([
        // ✅ depositAmount
        depositsCollection
          .aggregate([
            {
              $match: {
                status: "approved",
                createdAt: { $gte: monthStart, $lte: monthEnd },
              },
            },
            { $group: { _id: null, total: { $sum: "$depositAmount" } } },
          ])
          .toArray()
          .then((r) => r[0]?.total || 0),
        depositsCollection.countDocuments({
          status: "approved",
          createdAt: { $gte: monthStart, $lte: monthEnd },
        }),
        usersCollection.countDocuments({
          createdAt: { $gte: monthStart, $lte: monthEnd },
        }),
      ]);
      months.push({
        month: label,
        deposits,
        depositCount,
        newUsers,
        revenue: Math.round(deposits * 0.01),
      });
    }

    const planRevenue = await usersCollection
      .aggregate([
        { $match: { accountActive: true } },
        {
          $group: {
            _id: "$selectedPlan",
            count: { $sum: 1 },
            totalSaved: { $sum: "$totalSaved" },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();
    const totalPlanUsers =
      planRevenue.reduce((sum, p) => sum + p.count, 0) || 1;
    const formattedPlanRevenue = planRevenue.map((p) => ({
      plan: p._id || "Unknown",
      count: p.count,
      percentage: Math.round((p.count / totalPlanUsers) * 100),
      totalSaved: p.totalSaved,
    }));

    return res.status(200).json({
      success: true,
      data: {
        monthlyBreakdown: months,
        planRevenue: formattedPlanRevenue,
        totalRevenue: months.reduce((sum, m) => sum + m.revenue, 0),
        totalDeposits: months.reduce((sum, m) => sum + m.deposits, 0),
      },
    });
  } catch (error) {
    console.error("Get revenue data error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch revenue data",
      });
  }
};

// ==================== ADMIN SECURITY & FRAUD ====================
export const getSecurityEvents = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const loginHistoryCollection = db.collection("login_history");
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    const [events, total] = await Promise.all([
      loginHistoryCollection
        .find()
        .sort({ loginTime: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      loginHistoryCollection.countDocuments(),
    ]);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [failedLogins, suspiciousIPs, totalLogins] = await Promise.all([
      loginHistoryCollection.countDocuments({
        success: false,
        loginTime: { $gte: last24h },
      }),
      loginHistoryCollection
        .aggregate([
          { $match: { success: false, loginTime: { $gte: last24h } } },
          { $group: { _id: "$ip", count: { $sum: 1 } } },
          { $match: { count: { $gt: 3 } } },
          { $count: "count" },
        ])
        .toArray()
        .then((r) => r[0]?.count || 0),
      loginHistoryCollection.countDocuments({ loginTime: { $gte: last24h } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        events: events.map((e) => ({
          id: e._id,
          type: e.success ? "login" : "failed_login",
          event: e.success
            ? "Successful login"
            : `Failed login — ${e.failureReason || "Invalid credentials"}`,
          ip: e.ip,
          device: e.device,
          browser: e.browser,
          os: e.os,
          location: e.location,
          userId: e.userId,
          identifier: e.identifier,
          time: e.loginTime,
          status: e.success ? "success" : "danger",
        })),
        stats: {
          totalLogins24h: totalLogins,
          failedLogins24h: failedLogins,
          suspiciousIPs,
          uptime: "99.9%",
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
    console.error("Get security events error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch security events",
      });
  }
};

export const getFraudAlerts = async (req, res) => {
  try {
    const usersCollection = db.collection("users");
    const loginHistoryCollection = db.collection("login_history");
    const depositsCollection = db.collection("deposits");
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const failedLoginUsers = await loginHistoryCollection
      .aggregate([
        { $match: { success: false, loginTime: { $gte: last24h } } },
        {
          $group: {
            _id: "$identifier",
            count: { $sum: 1 },
            ips: { $addToSet: "$ip" },
          },
        },
        { $match: { count: { $gt: 5 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    const bannedUsers = await usersCollection
      .find(
        { $or: [{ isBanned: true }, { isSuspended: true }] },
        { projection: { password: 0, pin: 0 } },
      )
      .limit(10)
      .toArray();

    // ✅ depositAmount
    const unusualDeposits = await depositsCollection
      .aggregate([
        { $match: { createdAt: { $gte: last24h } } },
        {
          $group: {
            _id: "$userId",
            count: { $sum: 1 },
            totalAmount: { $sum: "$depositAmount" }, // ✅
          },
        },
        { $match: { count: { $gt: 5 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    const alerts = [
      ...failedLoginUsers.map((u) => ({
        type: "suspicious_login",
        severity: u.count > 10 ? "high" : "medium",
        title: "Multiple Failed Logins",
        description: `Identifier ${u._id} had ${u.count} failed login attempts`,
        riskScore: Math.min(u.count * 5, 100),
        identifier: u._id,
        ips: u.ips,
        status: "active",
      })),
      ...bannedUsers.map((u) => ({
        type: u.isBanned ? "banned" : "suspended",
        severity: "high",
        title: u.isBanned ? "Banned User" : "Suspended User",
        description: `${u.fullName || u.firstName} — ${u.banReason || u.suspensionReason || "No reason provided"}`,
        riskScore: 100,
        userId: u._id,
        userName: u.fullName || u.firstName,
        status: "resolved",
      })),
      ...unusualDeposits.map((u) => ({
        type: "unusual_deposits",
        severity: u.count > 10 ? "high" : "medium",
        title: "Unusual Deposit Pattern",
        description: `${u.user?.fullName || u.user?.firstName || "Unknown"} made ${u.count} deposits (৳${u.totalAmount}) in 24h`,
        riskScore: Math.min(u.count * 8, 100),
        userId: u._id,
        userName: u.user?.fullName || u.user?.firstName,
        status: "active",
      })),
    ];

    return res.status(200).json({
      success: true,
      data: {
        alerts: alerts.slice(0, 20),
        stats: {
          highRisk: alerts.filter((a) => a.severity === "high").length,
          mediumRisk: alerts.filter((a) => a.severity === "medium").length,
          lowRisk: alerts.filter((a) => a.severity === "low").length,
          resolved: alerts.filter((a) => a.status === "resolved").length,
          active: alerts.filter((a) => a.status === "active").length,
          suspended: bannedUsers.filter((u) => u.isSuspended).length,
          banned: bannedUsers.filter((u) => u.isBanned).length,
        },
      },
    });
  } catch (error) {
    console.error("Get fraud alerts error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch fraud alerts",
      });
  }
};

// ==================== ADMIN SETTINGS & CMS ====================
export const getPlatformSettings = async (req, res) => {
  try {
    const settingsCollection = db.collection("platform_settings");
    let settings = await settingsCollection.findOne({ key: "platform" });
    if (!settings) {
      settings = {
        key: "platform",
        general: {
          name: "Amanah Savings",
          tagline: "Islamic Savings Platform for Bangladesh",
          url: "https://amanah-savings.vercel.app",
          supportEmail: "support@amanah.bd",
          supportPhone: "+880 1800-000000",
          language: "bn",
          currency: "BDT",
          timezone: "Asia/Dhaka",
        },
        savings: {
          minDeposit: 500,
          maxDeposit: 100000,
          dailyDepositLimit: 500000,
          minWithdrawal: 1000,
          maxWithdrawal: 50000,
          earlyWithdrawalFee: 2,
          goalMaturityPeriod: 30,
        },
        payments: {
          bkashEnabled: true,
          nagadEnabled: true,
          rocketEnabled: true,
          bankTransferEnabled: true,
          cardEnabled: false,
        },
        notifications: {
          depositConfirmation: true,
          withdrawalConfirmation: true,
          goalMilestone: true,
          streakReminder: true,
          monthlyReport: true,
          marketingEmails: false,
        },
        security: {
          twoFactorEnabled: false,
          pinRequired: true,
          sessionTimeout: 30,
          maxLoginAttempts: 5,
          passwordMinLength: 8,
        },
        maintenance: { mode: false, message: "", allowedIps: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("Get platform settings error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch settings",
      });
  }
};

export const updatePlatformSettings = async (req, res) => {
  try {
    const updates = req.body;
    const settingsCollection = db.collection("platform_settings");
    await settingsCollection.updateOne(
      { key: "platform" },
      { $set: { ...updates, updatedAt: new Date() } },
      { upsert: true },
    );
    return res
      .status(200)
      .json({ success: true, message: "Settings updated successfully" });
  } catch (error) {
    console.error("Update platform settings error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to update settings",
      });
  }
};

export const getCmsContent = async (req, res) => {
  try {
    const cmsCollection = db.collection("cms_content");
    let cms = await cmsCollection.findOne({ key: "cms" });
    if (!cms) {
      cms = {
        key: "cms",
        site: {
          name: "Amanah Savings",
          tagline: "Islamic Savings Platform for Bangladesh",
          logo: "",
          favicon: "",
          primaryColor: "#059669",
          secondaryColor: "#10b981",
        },
        homepage: {
          heroTitle: "Save for Your Dreams, the Halal Way",
          heroSubtitle:
            "Join thousands of Bangladeshis building a secure financial future with Islamic savings goals",
          ctaText: "Start Saving Today",
          stats: [
            { label: "Members", value: "Growing", icon: "👥" },
            { label: "Total Savings", value: "Building", icon: "💰" },
            { label: "Goals Created", value: "Active", icon: "🎯" },
            { label: "Satisfaction", value: "Trusted", icon: "⭐" },
          ],
        },
        navigation: [
          { label: "Home", url: "/", icon: "🏠" },
          { label: "Plans", url: "/plans", icon: "📋" },
          { label: "How It Works", url: "/how-it-works", icon: "❓" },
          { label: "FAQ", url: "/faq", icon: "📖" },
          { label: "Contact", url: "/contact", icon: "📧" },
        ],
        plans: [
          {
            name: "Bronze",
            min: 500,
            max: 4999,
            color: "#cd7f32",
            features: [
              "Basic savings goals",
              "Monthly reports",
              "Email support",
            ],
          },
          {
            name: "Silver",
            min: 5000,
            max: 14999,
            color: "#c0c0c0",
            features: [
              "Multiple goals",
              "Weekly reports",
              "Priority support",
              "Referral bonuses",
            ],
          },
          {
            name: "Gold",
            min: 15000,
            max: 49999,
            color: "#ffd700",
            features: [
              "Unlimited goals",
              "Daily insights",
              "VIP support",
              "Higher bonuses",
              "Circle access",
            ],
          },
          {
            name: "Platinum",
            min: 50000,
            max: null,
            color: "#e5e4e2",
            features: [
              "Everything in Gold",
              "Personal advisor",
              "Custom goals",
              "API access",
              "White-label options",
            ],
          },
        ],
        faq: [
          {
            question: "What is Amanah Savings?",
            answer: "Amanah Savings is an Islamic savings platform...",
          },
          {
            question: "How do I start saving?",
            answer: "Create an account, complete KYC, choose a plan...",
          },
          {
            question: "Is my money safe?",
            answer: "Yes, we use bank-grade encryption and partner with...",
          },
          {
            question: "Can I withdraw early?",
            answer:
              "Yes, but a small fee applies to maintain platform sustainability...",
          },
        ],
        announcements: {
          enabled: false,
          text: "",
          link: "",
          startDate: null,
          endDate: null,
        },
        footer: {
          copyright: "© 2026 Amanah Savings. All rights reserved.",
          links: [
            { label: "Privacy Policy", url: "/privacy" },
            { label: "Terms of Service", url: "/terms" },
            { label: "Contact Us", url: "/contact" },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return res.status(200).json({ success: true, data: cms });
  } catch (error) {
    console.error("Get CMS content error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch CMS content",
      });
  }
};

export const updateCmsContent = async (req, res) => {
  try {
    const updates = req.body;
    const cmsCollection = db.collection("cms_content");
    await cmsCollection.updateOne(
      { key: "cms" },
      { $set: { ...updates, updatedAt: new Date() } },
      { upsert: true },
    );
    return res
      .status(200)
      .json({ success: true, message: "CMS content updated successfully" });
  } catch (error) {
    console.error("Update CMS content error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to update CMS content",
      });
  }
};

// ==================== ADMIN TRANSACTIONS ====================
export const getAllTransactions = async (req, res) => {
  try {
    const { type = "all", status, page = 1, limit = 20, search } = req.query;
    const depositsCollection = db.collection("deposits");
    const withdrawalsCollection = db.collection("withdrawals");
    const usersCollection = db.collection("users");
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let transactions = [];
    let total = 0;

    const depositQuery = {};
    if (status && status !== "all") depositQuery.status = status;
    if (search) {
      depositQuery.$or = [
        { transactionReference: { $regex: search, $options: "i" } }, // ✅
        { paymentMethod: { $regex: search, $options: "i" } }, // ✅
        { goalName: { $regex: search, $options: "i" } },
      ];
    }

    const withdrawalQuery = {};
    if (status && status !== "all") withdrawalQuery.status = status;
    if (search) {
      withdrawalQuery.$or = [
        { transactionId: { $regex: search, $options: "i" } }, // ✅
        { paymentMethod: { $regex: search, $options: "i" } }, // ✅
        { goalName: { $regex: search, $options: "i" } },
      ];
    }

    if (type === "all" || type === "deposit") {
      const deposits = await depositsCollection
        .find(depositQuery)
        .sort({ createdAt: -1 })
        .skip(type === "all" ? 0 : skip)
        .limit(limitNum)
        .toArray();

      for (const d of deposits) {
        const user = d.userId
          ? await usersCollection.findOne(
              { _id: new ObjectId(d.userId) },
              { projection: { password: 0, pin: 0 } },
            )
          : null;
        transactions.push({
          id: d._id,
          type: "deposit",
          transactionId: d.transactionReference || d._id.toString(), // ✅
          amount: d.depositAmount, // ✅
          status: d.status,
          method: d.paymentMethod, // ✅
          goalName: d.goalName,
          goalType: d.goalType,
          userId: d.userId,
          userName:
            user?.fullName ||
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
            "Unknown", // ✅
          userPhone: user?.phone,
          screenshot: d.screenshot || null,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      }
    }

    if (type === "all" || type === "withdrawal") {
      const withdrawals = await withdrawalsCollection
        .find(withdrawalQuery)
        .sort({ createdAt: -1 })
        .skip(type === "all" ? 0 : skip)
        .limit(limitNum)
        .toArray();

      for (const w of withdrawals) {
        const user = w.userId
          ? await usersCollection.findOne(
              { _id: new ObjectId(w.userId) },
              { projection: { password: 0, pin: 0 } },
            )
          : null;
        transactions.push({
          id: w._id,
          type: "withdrawal",
          transactionId: w.transactionId || w._id.toString(), // ✅
          amount: w.withdrawalAmount, // ✅
          status: w.status,
          method: w.paymentMethod, // ✅
          goalName: w.goalName,
          goalType: w.goalType,
          userId: w.userId,
          userName:
            user?.fullName ||
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
            "Unknown", // ✅
          userPhone: user?.phone,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        });
      }
    }

    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (type === "all") {
      total =
        (await depositsCollection.countDocuments(depositQuery)) +
        (await withdrawalsCollection.countDocuments(withdrawalQuery));
      transactions = transactions.slice(skip, skip + limitNum);
    } else if (type === "deposit") {
      total = await depositsCollection.countDocuments(depositQuery);
    } else {
      total = await withdrawalsCollection.countDocuments(withdrawalQuery);
    }

    const [
      pendingDeposits,
      approvedDeposits,
      pendingWithdrawals,
      completedWithdrawals,
      totalDepositAmount,
      totalWithdrawalAmount,
    ] = await Promise.all([
      depositsCollection.countDocuments({ status: "pending" }),
      depositsCollection.countDocuments({ status: "approved" }),
      withdrawalsCollection.countDocuments({ status: "pending" }),
      withdrawalsCollection.countDocuments({ status: "completed" }),
      // ✅ depositAmount
      depositsCollection
        .aggregate([
          { $match: { status: "approved" } },
          { $group: { _id: null, total: { $sum: "$depositAmount" } } },
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
      // ✅ withdrawalAmount
      withdrawalsCollection
        .aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$withdrawalAmount" } } },
        ])
        .toArray()
        .then((r) => r[0]?.total || 0),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        stats: {
          pendingDeposits,
          approvedDeposits,
          pendingWithdrawals,
          completedWithdrawals,
          totalDepositAmount,
          totalWithdrawalAmount,
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
    console.error("Get all transactions error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch transactions",
      });
  }
};

// ==================== HELPERS ====================
const getIconForType = (type) => {
  const icons = {
    deposit: "💳",
    streak: "🔥",
    reminder: "⏰",
    bonus: "🤝",
    achievement: "🏆",
    milestone: "✅",
    system: "🔔",
    withdrawal: "💸",
    challenge: "🎯",
  };
  return icons[type] || "🔔";
};

const getBadgeForType = (type) => {
  const badges = {
    deposit: "Deposit",
    streak: "Streak",
    reminder: "Reminder",
    bonus: "Bonus",
    achievement: "Achievement",
    milestone: "Milestone",
    system: "System",
    withdrawal: "Withdrawal",
    challenge: "Challenge",
  };
  return badges[type] || "System";
};
