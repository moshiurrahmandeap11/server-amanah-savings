import { ObjectId } from "mongodb";
import { db } from "../../database/db.js";
import { clearMaintenanceCache, getMaintenanceState } from "../../utils/maintenanceMode.js";

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
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      fullName:
        user.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
      phone: user.phone || "",
      email: user.email || "",
      role: user.role || "user",
      selectedPlan: user.selectedPlan || "bronze",
      level: Number(user.level) || 1,
      totalSaved: Number(user.totalSaved) || 0,
      totalDeposits: Number(user.totalDeposits) || 0,
      totalWithdrawals: Number(user.totalWithdrawals) || 0,
      accountActive: Boolean(user.accountActive),
      kycStatus: user.kyc?.status || "pending",
      kycCompleted: Boolean(user.kycCompleted),
      isBanned: Boolean(user.isBanned),
      isSuspended: Boolean(user.isSuspended),
      suspensionReason: user.suspensionReason || null,
      banReason: user.banReason || null,
      profilePicture: user.profilePicture || null,
      referralCode: user.referralCode || null,
      createdAt: user.createdAt || null,
      lastLogin: user.lastLogin || null,
      division: user.division || null,
      district: user.district || null,
      occupation: user.occupation || null,
      income: user.income || null,
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
    console.log("[getUserById] Requested user ID:", id);

    if (!id || !ObjectId.isValid(id)) {
      console.log("[getUserById] Invalid user ID format:", id);
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, pin: 0 } },
    );
    if (!user) {
      console.log("[getUserById] User not found for ID:", id);
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

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

    const circles = await db
      .collection("circles")
      .find({ "members.userId": new ObjectId(id) })
      .sort({ createdAt: -1 })
      .toArray();

    const transfers = await db
      .collection("transfers")
      .find({
        $or: [
          { userId: new ObjectId(id) },
          { fromUserId: new ObjectId(id) },
          { toUserId: new ObjectId(id) },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return res.status(200).json({
      success: true,
      data: {
        user: { id: user._id, ...user },
        deposits: deposits.map((d) => ({
          id: d._id,
          amount: d.depositAmount,
          status: d.status,
          method: d.paymentMethod,
          goalName: d.goalName,
          createdAt: d.createdAt,
        })),
        withdrawals: withdrawals.map((w) => ({
          id: w._id,
          amount: w.withdrawalAmount,
          status: w.status,
          method: w.paymentMethod,
          goalName: w.goalName,
          createdAt: w.createdAt,
        })),
        goals: goals.map((g) => ({
          id: g._id,
          title: g.goalName,
          targetAmount: g.targetAmount,
          currentAmount: g.currentSaved,
          status: g.status,
          goalType: g.goalType,
          createdAt: g.createdAt,
        })),
        loginHistory: loginHistory.map((h) => ({
          id: h._id,
          success: h.success,
          ip: h.ip,
          device: h.device,
          location: h.location,
          loginTime: h.loginTime,
        })),
        circles: circles.map((c) => {
          const memberEntry = (c.members || []).find((m) => m.userId && m.userId.toString() === id);
          return {
            id: c._id,
            name: c.circleName,
            purpose: c.purpose,
            circleType: c.circleType,
            targetAmount: c.targetAmount,
            totalPool: c.totalPool,
            currentMembers: c.currentMembers,
            maxMembers: c.maxMembers,
            status: c.status,
            role: memberEntry?.role || "member",
            joinedAt: memberEntry?.joinedAt,
            createdAt: c.createdAt,
          };
        }),
        transfers: transfers.map((tr) => ({
          id: tr._id,
          type: tr.transferType || tr.type || "transfer",
          amount: tr.amount,
          status: tr.status,
          fromGoalName: tr.fromGoalName || tr.sourceGoalName,
          toGoalName: tr.toGoalName || tr.destinationGoalName,
          fromUserName: tr.fromUserName,
          toUserName: tr.toUserName,
          toPhone: tr.toPhone,
          note: tr.note || tr.description,
          createdAt: tr.createdAt,
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

export const updateUserPersonalInfo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const {
      firstName,
      lastName,
      phone,
      email,
      dob,
      gender,
      occupation,
      income,
      division,
      district,
      upazila,
      village,
      postOffice,
      postCode,
    } = req.body;

    const usersCollection = db.collection("users");
    const userId = new ObjectId(id);
    const existingUser = await usersCollection.findOne({ _id: userId });

    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const updateData = { updatedAt: new Date() };
    const setIfProvided = (field, value) => {
      if (value !== undefined) updateData[field] = value;
    };

    const normalizedFirstName =
      firstName === undefined
        ? undefined
        : firstName === null
          ? ""
          : String(firstName).trim();
    const normalizedLastName =
      lastName === undefined || lastName === null
        ? lastName
        : String(lastName).trim();
    const normalizedPhone =
      phone === undefined
        ? undefined
        : phone === null
          ? ""
          : String(phone).trim();
    const normalizedEmail =
      email === undefined || email === null || email === ""
        ? email
        : String(email).trim().toLowerCase();

    if (firstName !== undefined && !normalizedFirstName) {
      return res
        .status(400)
        .json({ success: false, message: "First name cannot be empty" });
    }

    if (phone !== undefined && !normalizedPhone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number cannot be empty" });
    }

    if (
      normalizedEmail !== undefined &&
      normalizedEmail &&
      !/^\S+@\S+\.\S+$/.test(normalizedEmail)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email address" });
    }

    if (phone !== undefined || email !== undefined) {
      const duplicateConditions = [];
      if (normalizedPhone !== undefined)
        duplicateConditions.push({ phone: normalizedPhone });
      if (normalizedEmail !== undefined && normalizedEmail)
        duplicateConditions.push({ email: normalizedEmail });

      if (duplicateConditions.length > 0) {
        const duplicateUser = await usersCollection.findOne({
          _id: { $ne: userId },
          $or: duplicateConditions,
        });

        if (duplicateUser) {
          return res.status(400).json({
            success: false,
            message:
              duplicateUser.phone === normalizedPhone
                ? "Phone number already registered"
                : "Email already registered",
          });
        }
      }
    }

    setIfProvided("firstName", normalizedFirstName);
    setIfProvided("lastName", normalizedLastName);
    setIfProvided("phone", normalizedPhone);
    setIfProvided("email", normalizedEmail);
    setIfProvided("dob", dob);
    setIfProvided("gender", gender);
    setIfProvided("occupation", occupation);
    setIfProvided("income", income);
    setIfProvided("division", division);
    setIfProvided("district", district);
    setIfProvided("upazila", upazila);
    setIfProvided("village", village);
    setIfProvided("postOffice", postOffice);
    setIfProvided("postCode", postCode);

    if (firstName !== undefined || lastName !== undefined) {
      updateData.fullName = `${updateData.firstName ?? existingUser.firstName ?? ""} ${
        updateData.lastName ?? existingUser.lastName ?? ""
      }`.trim();
    }

    if (
      division !== undefined ||
      district !== undefined ||
      upazila !== undefined ||
      village !== undefined ||
      postOffice !== undefined ||
      postCode !== undefined
    ) {
      updateData.address = {
        division: division ?? existingUser.division ?? null,
        district: district ?? existingUser.district ?? null,
        upazila: upazila ?? existingUser.upazila ?? null,
        village: village ?? existingUser.village ?? null,
        postOffice: postOffice ?? existingUser.postOffice ?? null,
        postCode: postCode ?? existingUser.postCode ?? null,
      };
    }

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({
        success: false,
        message: "No valid personal information fields provided",
      });
    }

    await usersCollection.updateOne({ _id: userId }, { $set: updateData });

    const updatedUser = await usersCollection.findOne(
      { _id: userId },
      { projection: { password: 0, pin: 0 } },
    );

    return res.status(200).json({
      success: true,
      message: "User personal information updated successfully",
      data: { user: { id: updatedUser._id, ...updatedUser } },
    });
  } catch (error) {
    console.error("Update user personal info error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update user personal information",
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
    // Using $nor because $not is not valid as a top-level operator in MongoDB
    conditions.push({
      $nor: [
        {
          "kyc.status": "skipped",
          "kyc.nidFrontImage": { $in: [null, ""], $exists: true },
          "kyc.nidBackImage": { $in: [null, ""], $exists: true },
          "kyc.selfieImage": { $in: [null, ""], $exists: true },
          "kyc.birthCertificateImage": { $in: [null, ""], $exists: true },
          "kyc.passportImage": { $in: [null, ""], $exists: true },
        }
      ]
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
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      fullName:
        user.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
      phone: user.phone || "",
      email: user.email || "",
      nidNumber: user.kyc?.nidNumber || null,
      kycStatus: user.kyc?.status || "pending",
      kycSubmittedAt: user.kyc?.submittedAt || null,
      kycVerifiedAt: user.kyc?.verifiedAt || null,
      kycRejectionReason: user.kyc?.rejectionReason || null,
      islamicMode: Boolean(user.kyc?.islamicMode),
      kycConsent: Boolean(user.kyc?.kycConsent),
      accountActive: Boolean(user.accountActive),
      selectedPlan: user.selectedPlan || "bronze",
      profilePicture: user.profilePicture || null,
      division: user.division || null,
      district: user.district || null,
      upazila: user.upazila || null,
      village: user.village || null,
      postOffice: user.postOffice || null,
      postCode: user.postCode || null,
      occupation: user.occupation || null,
      income: user.income || null,
      dob: user.dob || null,
      gender: user.gender || null,
      createdAt: user.createdAt || null,
      // KYC Document URLs - check both nested kyc object and root level (fallback)
      nidFrontUrl: user.kyc?.nidFrontImage || user.nidFrontImage || null,
      nidBackUrl: user.kyc?.nidBackImage || user.nidBackImage || null,
      selfieUrl: user.kyc?.selfieImage || user.selfieImage || null,
      birthCertificateUrl: user.kyc?.birthCertificateImage || user.birthCertificateImage || null,
      passportUrl: user.kyc?.passportImage || user.passportImage || null,
      // Nominee info
      nominee: user.nominee || null,
      // Payment info
      paymentMethod: user.paymentMethod || null,
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
              u.fullName || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User",
            phone: u.phone || "",
            plan: u.selectedPlan || "bronze",
            kycStatus: u.kyc?.status || "pending",
            createdAt: u.createdAt || null,
          })),
          deposits: recentDeposits.map((d) => ({
            id: d._id,
            userId: d.userId || null,
            amount: Number(d.depositAmount) || 0,
            method: d.paymentMethod || "N/A",
            goalName: d.goalName || "N/A",
            status: d.status || "pending",
            createdAt: d.createdAt || null,
          })),
          withdrawals: recentWithdrawals.map((w) => ({
            id: w._id,
            userId: w.userId || null,
            amount: Number(w.withdrawalAmount) || 0,
            method: w.paymentMethod || "N/A",
            goalName: w.goalName || "N/A",
            status: w.status || "pending",
            createdAt: w.createdAt || null,
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
              userId: 1,
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

    const { emitTicketReply } = await import("../../socket/socket.js");
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
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [activeLast7Days, totalActiveUsers, totalUsers, newUsersToday, todaysDeposits] = await Promise.all([
      loginHistoryCollection
        .aggregate([
          { $match: { loginTime: { $gte: last7Days }, success: true } },
          { $group: { _id: "$userId" } },
          { $count: "count" },
        ])
        .toArray()
        .then((r) => r[0]?.count || 0),
      usersCollection.countDocuments({ accountActive: true }),
      usersCollection.countDocuments(),
      usersCollection.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),
      db.collection("deposits").aggregate([
        { $match: { createdAt: { $gte: todayStart, $lt: todayEnd }, status: "approved" } },
        { $group: { _id: null, total: { $sum: "$depositAmount" } } },
      ]).toArray().then(r => r[0]?.total || 0),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        dau: {
          labels: dauData.map(d => d.date),
          values: dauData.map(d => d.users),
        },
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
        totalUsers,
        newUsersToday,
        todaysDeposits,
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
export const defaultPaymentInstructions = {
  en: {
    title: "Payment Instructions",
    sendMoneyToLabel: "Send money to:",
    sendMoneyTo: "018XXXXXXXX",
    amountLabel: "Amount:",
    amountValue: "৳{amount}",
    referenceLabel: "Reference:",
    reference: "DEV-TEST-DEPOSIT",
  },
  bn: {
    title: "পেমেন্ট নির্দেশনা",
    sendMoneyToLabel: "টাকা পাঠান:",
    sendMoneyTo: "018XXXXXXXX",
    amountLabel: "পরিমাণ:",
    amountValue: "৳{amount}",
    referenceLabel: "রেফারেন্স:",
    reference: "DEV-TEST-DEPOSIT",
  },
};

// Default per-method payment details
export const defaultPaymentMethods = {
  bkash: {
    enabled: true,
    number: "018XXXXXXXX",
    accountName: "Sanchoy Bondhu",
    type: "personal",
    instructions: {
      en: "Send money via bKash to this number. Use your email as reference.",
      bn: "বিকাশ-এর মাধ্যমে এই নম্বরে টাকা পাঠান। রেফারেন্স হিসেবে আপনার ইমেইল ব্যবহার করুন।",
    },
  },
  nagad: {
    enabled: true,
    number: "018XXXXXXXX",
    accountName: "Sanchoy Bondhu",
    type: "personal",
    instructions: {
      en: "Send money via Nagad to this number. Use your email as reference.",
      bn: "নগদ-এর মাধ্যমে এই নম্বরে টাকা পাঠান। রেফারেন্স হিসেবে আপনার ইমেইল ব্যবহার করুন।",
    },
  },
  bank: {
    enabled: true,
    bankName: "Dutch-Bangla Bank Limited",
    accountNumber: "1234567890123",
    accountHolderName: "Sanchoy Bondhu",
    branch: "Main Branch",
    routingNumber: "090110000",
    instructions: {
      en: "Transfer to the bank account below. Use your email as reference.",
      bn: "নিচের ব্যাংক অ্যাকাউন্টে ট্রান্সফার করুন। রেফারেন্স হিসেবে আপনার ইমেইল ব্যবহার করুন।",
    },
  },
};

export const normalizePaymentInstructions = (instructions = {}) => ({
  en: {
    ...defaultPaymentInstructions.en,
    ...(instructions.en || {}),
  },
  bn: {
    ...defaultPaymentInstructions.bn,
    ...(instructions.bn || {}),
  },
});

export const normalizePaymentMethods = (methods = {}) => ({
  bkash: {
    ...defaultPaymentMethods.bkash,
    ...(methods.bkash || {}),
  },
  nagad: {
    ...defaultPaymentMethods.nagad,
    ...(methods.nagad || {}),
  },
  bank: {
    ...defaultPaymentMethods.bank,
    ...(methods.bank || {}),
  },
});

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
          instructions: defaultPaymentInstructions,
          methods: defaultPaymentMethods,
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
        referrals: {
          bonusAmount: 500,
          minimumDeposit: 500,
        },
        maintenance: { mode: false, message: "", allowedIps: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    settings.payments = {
      ...(settings.payments || {}),
      instructions: normalizePaymentInstructions(settings.payments?.instructions),
      methods: normalizePaymentMethods(settings.payments?.methods),
    };

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
    const existingSettings = await settingsCollection.findOne({ key: "platform" });
    const existingPayments = existingSettings?.payments || {};
    const nextPayments = updates.payments
      ? {
          ...existingPayments,
          ...updates.payments,
          instructions: normalizePaymentInstructions(
            updates.payments.instructions || existingPayments.instructions,
          ),
          methods: normalizePaymentMethods(
            updates.payments.methods || existingPayments.methods,
          ),
        }
      : existingPayments;

    await settingsCollection.updateOne(
      { key: "platform" },
      { $set: { ...updates, payments: nextPayments, updatedAt: new Date() } },
      { upsert: true },
    );

    if (updates.maintenance) {
      clearMaintenanceCache();
    }

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

export const getPaymentInstructions = async (req, res) => {
  try {
    const settingsCollection = db.collection("platform_settings");
    const settings = await settingsCollection.findOne(
      { key: "platform" },
      { projection: { "payments.instructions": 1, "payments.methods": 1 } },
    );

    return res.status(200).json({
      success: true,
      data: {
        instructions: normalizePaymentInstructions(settings?.payments?.instructions),
        methods: normalizePaymentMethods(settings?.payments?.methods),
      },
    });
  } catch (error) {
    console.error("Get payment instructions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payment instructions",
    });
  }
};

export const getPublicSystemStatus = async (req, res) => {
  try {
    const maintenance = await getMaintenanceState();

    return res.status(200).json({
      success: true,
      data: {
        maintenanceMode: maintenance.mode,
        maintenanceMessage: maintenance.message,
      },
    });
  } catch (error) {
    console.error("Get system status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch system status",
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
            monthlyFee: 0,
            yearlyFee: 0,
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
            monthlyFee: 199,
            yearlyFee: 159,
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
            monthlyFee: 499,
            yearlyFee: 399,
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
            monthlyFee: 999,
            yearlyFee: 799,
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
        comparisonGroups: [
          {
            label: "Savings Goals",
            icon: "Wallet",
            rows: [
              ["Active savings goals", "Up to 3", "Up to 6", "Unlimited", "Unlimited"],
              ["Min monthly deposit", "৳500", "৳1,000", "৳2,000", "৳5,000"],
              ["Max single deposit", "৳10,000", "৳25,000", "৳1,00,000", "৳5,00,000"],
              ["Goal lock period", "3-12 months", "3-24 months", "3-60 months", "Custom"],
            ],
          },
          {
            label: "Payments",
            icon: "CreditCard",
            rows: [
              ["bKash & Nagad", true, true, true, true],
              ["Bank Transfer", false, true, true, true],
              ["Withdrawal time", "7-10 days", "5-7 days", "3 days", "24 hours"],
              ["Early withdrawal", false, "With fee", "With fee", "Free once/yr"],
            ],
          },
          {
            label: "Community Circles",
            icon: "Users",
            rows: [
              ["Join circles", false, "1 circle", "3 circles", "10 circles"],
              ["Create circles", false, false, "1 circle", "3 circles"],
              ["Circle admin tools", false, false, true, true],
            ],
          },
          {
            label: "AI & Insights",
            icon: "Bot",
            rows: [
              ["Savings insights report", false, "Monthly", "Weekly", "Daily"],
              ["AI financial assistant", false, false, true, "Advanced+"],
              ["Goal projections", "Basic", "Standard", "Advanced", "Advanced+"],
            ],
          },
          {
            label: "Gamification",
            icon: "Trophy",
            rows: [
              ["Streak tracking", true, true, true, true],
              ["Achievement badges", "5 badges", "20 badges", "All badges", "All + exclusive"],
              ["Community leaderboard", false, "View only", "Full access", "Featured profile"],
              ["Savings challenges", false, true, true, true],
            ],
          },
          {
            label: "Security & Support",
            icon: "ShieldCheck",
            rows: [
              ["KYC verification", "Standard", "Standard", "Enhanced", "Premium"],
              ["2-factor auth", true, true, true, true],
              ["Customer support", "Email", "Email + Chat", "Priority chat", "Dedicated manager"],
              ["Account manager", false, false, false, true],
            ],
          },
          {
            label: "Islamic Mode",
            icon: "Moon",
            rows: [
              ["Riba-free savings", true, true, true, true],
              ["Halal goal categories", true, true, true, true],
            ],
          },
        ],
        faq: [
          {
            question: { en: "Can I change my plan later?", bn: "আমি কি পরে আমার প্ল্যান পরিবর্তন করতে পারি?" },
            answer: { en: "Yes! You can upgrade your plan at any time from your dashboard settings. Downgrading is also possible at the end of your current billing cycle, though features like additional circles or AI access will be removed if you move to a lower tier.", bn: "হ্যাঁ! আপনি যেকোনো সময় আপনার ড্যাশবোর্ড সেটিংস থেকে আপনার প্ল্যান আপগ্রেড করতে পারেন। ডাউনগ্রেডিং আপনার বর্তমান বিলিং চক্রের শেষেও সম্ভব, তবে আপনি যদি নিম্ন টিয়ারে যান তবে অতিরিক্ত সার্কেল বা এআই অ্যাক্সেসের মতো বৈশিষ্ট্যগুলি সরানো হবে।" },
          },
          {
            question: { en: "Is there a free trial for paid plans?", bn: "পেইড প্ল্যানের জন্য কি বিনামূল্যে ট্রায়াল আছে?" },
            answer: { en: "Silver and Gold plans include a 30-day free trial with full features. Platinum offers a 14-day trial with a dedicated account manager. No credit card required to start, just KYC verification.", bn: "সিলভার এবং গোল্ড প্ল্যানে ৩০-দিনের বিনামূল্যে ট্রায়াল রয়েছে। প্লাটিনামে একটি ডেডিকেটেড অ্যাকাউন্ট ম্যানেজার সহ ১৪-দিনের ট্রায়াল রয়েছে। শুরু করতে কোন ক্রেডিট কার্ডের প্রয়োজন নেই, শুধু কেওয়াইসি যাচাইকরণ।" },
          },
          {
            question: { en: "What happens if I miss a monthly deposit?", bn: "যদি আমি মাসিক জমা মিস করি তাহলে কী হবে?" },
            answer: { en: "Missing a deposit breaks your savings streak but does not cancel your plan. Your goal timeline adjusts automatically. We send SMS reminders 3 days before your deposit date. There are no late fees.", bn: "জমা মিস করলে আপনার সঞ্চয় স্ট্রিক ভেঙে যায় কিন্তু আপনার প্ল্যান বাতিল হয় না। আপনার লক্ষ্য সময়রেখা স্বয়ংক্রিয়ভাবে সামঞ্জস্য হয়। আপনার জমার তারিখের ৩ দিন আগে আমরা এসএমএস রিমাইন্ডার পাঠাই। কোন বিলম্ব ফি নেই।" },
          },
          {
            question: { en: "How is this different from a bank savings account?", bn: "এটি ব্যাংক সঞ্চয় অ্যাকাউন্ট থেকে কীভাবে আলাদা?" },
            answer: { en: "Amanah is a digital savings community, not a bank. We do not offer interest, FDIC-style insurance, or banking services. We are a goal-tracking and community savings platform.", bn: "আমানাহ একটি ডিজিটাল সঞ্চয় সম্প্রদায়, ব্যাংক নয়। আমরা সুদ, এফডিআইসি-স্টাইল বীমা বা ব্যাংকিং পরিষেবা অফার করি না। আমরা একটি লক্ষ্য-ট্র্যাকিং এবং কমিউনিটি সঞ্চয় প্ল্যাটফর্ম।" },
          },
          {
            question: { en: "Can I withdraw before my goal date?", bn: "আমি কি আমার লক্ষ্য তারিখের আগে উত্তোলন করতে পারি?" },
            answer: { en: "Yes, but early withdrawals may incur a small processing fee to cover administrative costs. Bronze members cannot make early withdrawals. Platinum members get one free early withdrawal per year.", bn: "হ্যাঁ, কিন্তু অকাল উত্তোলনে প্রশাসনিক খরচ কভার করতে সামান্য প্রসেসিং ফি লাগতে পারে। ব্রোঞ্জ সদস্যরা অকাল উত্তোলন করতে পারেন না। প্লাটিনাম সদস্যরা বছরে একটি বিনামূল্যে অকাল উত্তোলন পায়।" },
          },
          {
            question: { en: "Is Islamic Mode available on all plans?", bn: "ইসলামিক মোড কি সব প্ল্যানে উপলব্ধ?" },
            answer: { en: "Yes, Islamic savings mode is available on every plan including Bronze. Toggle it on during registration or in your profile settings for riba-free goal and circle calculations.", bn: "হ্যাঁ, ইসলামিক সঞ্চয় মোড ব্রোঞ্জ সহ সব প্ল্যানে উপলব্ধ। নিবন্ধনের সময় বা আপনার প্রোফাইল সেটিংসে এটি সক্রিয় করুন রিবা-মুক্ত লক্ষ্য এবং সার্কেল গণনার জন্য।" },
          },
          {
            question: { en: "What payment methods are accepted?", bn: "কোন পেমেন্ট পদ্ধতি গ্রহণ করা হয়?" },
            answer: { en: "Bronze members can use bKash and Nagad. Silver, Gold, and Platinum members also have access to bank transfer. Deposits are manually verified within 24 hours by our finance team.", bn: "ব্রোঞ্জ সদস্যরা বিকাশ এবং নগদ ব্যবহার করতে পারেন। সিলভার, গোল্ড এবং প্লাটিনাম সদস্যরা ব্যাংক ট্রান্সফারও ব্যবহার করতে পারেন। আমাদের ফাইন্যান্স টিম দ্বারা ২৪ ঘন্টার মধ্যে জমা ম্যানুয়ালি যাচাই করা হয়।" },
          },
          {
            question: { en: "Are there any hidden fees?", bn: "কোন লুকানো ফি আছে?" },
            answer: { en: "No hidden fees, ever. The platform fee for Silver, Gold, and Platinum is clearly stated. We will always give notice before any fee changes.", bn: "কখনও কোন লুকানো ফি নেই। সিলভার, গোল্ড এবং প্লাটিনামের জন্য প্ল্যাটফর্ম ফি স্পষ্টভাবে উল্লেখ করা আছে। কোন ফি পরিবর্তনের আগে আমরা সর্বদা নোটিশ দেব।" },
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
          copyright: "© 2025 Sonchoy Bondhu Community. All rights reserved. Bangladesh.",
          socials: {
            facebook: "",
            twitter: "",
            instagram: "",
            linkedin: "",
          },
          links: [
            { label: "Privacy", url: "/privacy" },
            { label: "Terms and conditions", url: "/terms" },
            { label: "Withdrawal policy", url: "/terms" },
            { label: "Announcement", url: "/terms" },
          ],
          sections: [
            {
              title: "Platform",
              links: [
                { label: "How it works", url: "/how-it-works" },
                { label: "Savings plan", url: "/#savings-plan", isScroll: true, targetId: "savings-plan" },
                { label: "Savings goal", url: "/#savings-goal", isScroll: true, targetId: "savings-goal" },
                { label: "Community Circle", url: "/goals" },
                { label: "Security and trust", url: "/#security-trust", isScroll: true, targetId: "security-trust" },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About us", url: "/about-us" },
                { label: "Contact", url: "/contact" },
                { label: "Blog", url: "/blogs" },
                { label: "Career", url: "/about-us" },
                { label: "Press", url: "/press" },
              ],
            },
            {
              title: "Support",
              links: [
                { label: "Q&A", url: "/faq" },
                { label: "Help Center", url: "/faq" },
                { label: "Privacy Policy", url: "/privacy" },
                { label: "Terms of Use", url: "/terms" },
                { label: "Withdrawal policy", url: "/terms" },
              ],
            },
          ],
          brandName: "Sanchoy Bondhu",
          brandDesc: "Bangladesh's trusted digital savings community platform. Save together, achieve goals, build your future — in a halal and disciplined way.",
          announcementBadge: "Important Announcement:",
          announcementText: "Sonchoy Bondhu Community is a savings circle management platform. We are not a bank, investment company or financial institution. We do not guarantee any returns or profits. Savings are locked in according to the member's own and circle terms.",
          supportLabel: "Support",
          emailLabel: "Email",
          emailAddress: "sanchoybondhu@gmail.com",
        },
        aboutUs: {
          heroBadge: { en: "Our Story", bn: "আমাদের গল্প" },
          heroTitle: { en: "Built for Bangladesh's Savers", bn: "বাংলাদেশের সঞ্চয়কারীদের জন্য" },
          heroDesc: { en: "We started Amanah because we believed every Bangladeshi deserves a trusted, transparent, and community-powered way to save for what matters most.", bn: "আমরা আমানাহ শুরু করেছিলাম এই বিশ্বাসে যে প্রতিটি বাংলাদেশী একটি বিশ্বস্ত, স্বচ্ছ এবং সম্প্রদায়-চালিত উপায়ে সঞ্চয় করার সুযোগ পায়, যা তাদের জীবনের গুরুত্বপূর্ণ লক্ষ্যগুলো অর্জনে সহায়তা করে।" },
          stats: [
            { label: { en: "Active Members", bn: "সক্রিয় সদস্য" }, value: "47,000+", icon: "users" },
            { label: { en: "Total Saved", bn: "মোট সঞ্চয়" }, value: "৳2.4 Cr+", icon: "wallet" },
            { label: { en: "Savings Circles", bn: "সঞ্চয় সার্কেল" }, value: "1,200+", icon: "circles" },
            { label: { en: "Districts Covered", bn: "জেলা কভার করা হয়েছে" }, value: "64", icon: "map" },
          ],
          missionLabel: { en: "Our Mission", bn: "আমাদের লক্ষ্য" },
          missionTitle: { en: "Savings for Every Dream", bn: "প্রতিটি স্বপ্নের জন্য সঞ্চয়" },
          missionP1: { en: "Amanah Savings Community was founded in 2024 with a single belief: that saving money should be simple, social, and accessible to every Bangladeshi, whether they live in Dhaka or a remote village.", bn: "আমানাহ সঞ্চয় সম্প্রদায় ২০২৪ সালে প্রতিষ্ঠিত হয়েছিল একটি বিশ্বাস নিয়ে: যে টাকা সঞ্চয় করা সহজ, সামাজিক এবং প্রতিটি বাংলাদেশীর জন্য সহজলভ্য হওয়া উচিত, তারা ঢাকায় থাকুক বা প্রত্যন্ত গ্রামে।" },
          missionP2: { en: "We are not a bank, an investment platform, or a financial institution. We are a digital savings community that helps members set goals, track progress, and stay accountable through the power of community circles.", bn: "আমরা কোনো ব্যাংক, বিনিয়োগ প্ল্যাটফর্ম বা আর্থিক প্রতিষ্ঠান নই। আমরা একটি ডিজিটাল সঞ্চয় সম্প্রদায় যা সদস্যদের লক্ষ্য নির্ধারণ, অগ্রগতি ট্র্যাক এবং কমিউনিটি সার্কেলের মাধ্যমে দায়বদ্ধ থাকতে সহায়তা করে।" },
          missionP3: { en: "Every feature we build, from the AI savings assistant to the gamified streak system, is designed with one purpose: to help you reach your financial goals, one deposit at a time.", bn: "আমরা যে প্রতিটি ফিচার তৈরি করি, এআই সঞ্চয় সহায়ক থেকে গ্যামিফাইড স্ট্রিক সিস্টেম পর্যন্ত, একটি উদ্দেশ্যে ডিজাইন করা: আপনাকে আপনার আর্থিক লক্ষ্য অর্জনে সহায়তা করা, এক জমা থেকে আরেক জমা।" },
          missionBadge: { en: "Amanah Savings", bn: "আমানাহ সঞ্চয়" },
          missionSub: { en: "Trusted savings community", bn: "বিশ্বস্ত সঞ্চয় সম্প্রদায়" },
          missionTransparent: { en: "100% Transparent", bn: "১০০% স্বচ্ছ" },
          valuesLabel: { en: "Our Values", bn: "আমাদের মূল্যবোধ" },
          valuesTitle: { en: "What We Stand For", bn: "আমরা যা বিশ্বাস করি" },
          values: [
            { icon: "Handshake", title: { en: "Amanah (Trust)", bn: "আমানাহ (বিশ্বাস)" }, desc: { en: "We operate with complete transparency. No hidden fees, no unclear terms, no surprise deductions. Every taka you deposit is tracked and accounted for.", bn: "আমরা সম্পূর্ণ স্বচ্ছতার সাথে কাজ করি। কোনো লুকানো ফি নেই, কোনো অস্পষ্ট শর্ত নেই, কোনো অপ্রত্যাশিত কর্তন নেই। আপনি যে প্রতিটি টাকা জমা দেন তা ট্র্যাক এবং হিসাব করা হয়।" } },
            { icon: "Globe", title: { en: "Inclusive Access", bn: "সবার জন্য প্রবেশাধিকার" }, desc: { en: "From a ৳500 starter plan to a ৳5,000/month Platinum tier, we built Amanah so that anyone, at any income level, can start saving today.", bn: "৫০০ টাকার স্টার্টার প্ল্যান থেকে ৫,০০০ টাকা/মাসের প্লাটিনাম টিয়ার পর্যন্ত, আমরা আমানাহ তৈরি করেছি যাতে যে কেউ, যেকোনো আয়ের স্তরে, আজই সঞ্চয় শুরু করতে পারে।" } },
            { icon: "Moon", title: { en: "Halal First", bn: "হালাল প্রথম" }, desc: { en: "Islamic savings mode is available on every plan. We operate without interest (riba) and ensure all features comply with Halal finance principles.", bn: "ইসলামিক সঞ্চয় মোড প্রতিটি প্ল্যানে উপলব্ধ। আমরা সুদ (রিবা) ছাড়াই কাজ করি এবং নিশ্চিত করি যে সমস্ত ফিচার হালাল ফাইন্যান্স নীতির সাথে সঙ্গতিপূর্ণ।" } },
            { icon: "Users", title: { en: "Community Power", bn: "কমিউনিটি শক্তি" }, desc: { en: "Savings circles, leaderboards, referrals, and streaks, we believe saving together is more powerful than saving alone.", bn: "সঞ্চয় সার্কেল, লিডারবোর্ড, রেফারেল এবং স্ট্রিক, আমরা বিশ্বাস করি একসাথে সঞ্চয় করা একা সঞ্চয় করার চেয়ে বেশি শক্তিশালী।" } },
            { icon: "Lock", title: { en: "Privacy & Security", bn: "গোপনীয়তা ও নিরাপত্তা" }, desc: { en: "256-bit encryption, NID-verified KYC, and 2FA on all accounts. Your data and savings information stay private, always.", bn: "২৫৬-বিট এনক্রিপশন, এনআইডি-ভেরিফাইড কেওয়াইসি, এবং সব অ্যাকাউন্টে ২এফএ। আপনার ডেটা এবং সঞ্চয় তথ্য সবসময় গোপন থাকে।" } },
            { icon: "Target", title: { en: "Goal-Focused", bn: "লক্ষ্য-কেন্দ্রিক" }, desc: { en: "Every feature is built around your goals, not ours. The AI assistant, streak system, and progress tracking all exist to keep you on track.", bn: "প্রতিটি ফিচার আপনার লক্ষ্যের চারপাশে তৈরি, আমাদের নয়। এআই সহায়ক, স্ট্রেক সিস্টেম এবং অগ্রগতি ট্র্যাকিং সবই আপনাকে ট্র্যাকে রাখতে বিদ্যমান।" } },
          ],
          teamLabel: { en: "Meet the Team", bn: "দলের সাথে পরিচিত হোন" },
          teamTitle: { en: "The People Behind Amanah", bn: "আমানার পিছনের মানুষ" },
          teamDesc: { en: "A small, passionate team from Bangladesh, building the savings platform we wished we had.", bn: "বাংলাদেশ থেকে একটি ছোট, উদ্যমী দল, সেই সঞ্চয় প্ল্যাটফর্ম তৈরি করছে যা আমরা চাইতাম।" },
          team: [
            { icon: "Briefcase", name: { en: "Rafiqul Islam", bn: "রফিকুল ইসলাম" }, role: { en: "Co-Founder & CEO", bn: "সহ-প্রতিষ্ঠাতা ও সিইও" }, bio: { en: "Former fintech analyst at BRAC Bank. Passionate about financial inclusion for rural Bangladesh.", bn: "ব্র্যাক ব্যাংকে প্রাক্তন ফিনটেক বিশ্লেষক। গ্রামীণ বাংলাদেশের জন্য আর্থিক অন্তর্ভুক্তি সম্পর্কে আগ্রহী।" } },
            { icon: "Code", name: { en: "Nusrat Jahan", bn: "নুসরাত জাহান" }, role: { en: "Co-Founder & CTO", bn: "সহ-প্রতিষ্ঠাতা ও সিটিও" }, bio: { en: "10 years in software engineering. Built scalable platforms used by millions across South Asia.", bn: "সফটওয়্যার ইঞ্জিনিয়ারিংয়ে ১০ বছর। দক্ষিণ এশিয়া জুড়ে লক্ষ লক্ষ মানুষ ব্যবহার করে এমন স্কেলেবল প্ল্যাটফর্ম তৈরি করেছেন।" } },
            { icon: "Palette", name: { en: "Arif Hossain", bn: "আরিফ হোসেন" }, role: { en: "Head of Design", bn: "প্রধান ডিজাইনার" }, bio: { en: "UX designer with a love for building products that feel as good as they work.", bn: "ইউএক্স ডিজাইনার যিনি এমন পণ্য তৈরি করতে ভালোবাসেন যা দেখতে যেমন ভালো, কাজও তেমন ভালো করে।" } },
            { icon: "BarChart3", name: { en: "Fatema Khanam", bn: "ফাতেমা খানম" }, role: { en: "Head of Operations", bn: "প্রধান অপারেশন অফিসার" }, bio: { en: "Oversees member relations, KYC processes, and community circle management across all 64 districts.", bn: "সদস্য সম্পর্ক, কেওয়াইসি প্রক্রিয়া এবং সমস্ত ৬৪ জেলায় কমিউনিটি সার্কেল ব্যবস্থাপনা তত্ত্বাবধান করেন।" } },
          ],
          timelineLabel: { en: "Our Journey", bn: "আমাদের যাত্রা" },
          timelineTitle: { en: "From Idea to 47,000 Members", bn: "আইডিয়া থেকে ৪৭,০০০ সদস্য" },
          timeline: [
            { year: { en: "January 2024", bn: "জানুয়ারি ২০২৪" }, title: { en: "The Idea", bn: "আইডিয়া" }, desc: { en: "Rafiqul and Nusrat sketch the first concept of Amanah over tea in Dhaka.", bn: "রফিকুল ও নুসরাত ঢাকায় চায়ের কাপে আমানাহ-এর প্রথম কনসেপ্ট স্কেচ করেন।" } },
            { year: { en: "April 2024", bn: "এপ্রিল ২০২৪" }, title: { en: "Beta Launch", bn: "বেটা লঞ্চ" }, desc: { en: "First 200 beta members join, all from word of mouth. ৳8 lakh saved in first month.", bn: "প্রথম ২০০ বেটা সদস্য যোগ দেন, সবাই মুখের কথায়। প্রথম মাসে ৮ লক্ষ টাকা সঞ্চয় হয়।" } },
            { year: { en: "August 2024", bn: "আগস্ট ২০২৪" }, title: { en: "Circles Launch", bn: "সার্কেল লঞ্চ" }, desc: { en: "Savings Circles feature goes live, 100 circles formed in first 48 hours.", bn: "সঞ্চয় সার্কেল ফিচার চালু হয়, প্রথম ৪৮ ঘন্টায় ১০০টি সার্কেল গঠিত হয়।" } },
            { year: { en: "January 2025", bn: "জানুয়ারি ২০২৫" }, title: { en: "10,000 Members", bn: "১০,০০০ সদস্য" }, desc: { en: "Crossed 10,000 active members. Launched AI savings assistant for Gold/Platinum.", bn: "১০,০০০ সক্রিয় সদস্য অতিক্রম করে। গোল্ড/প্লাটিনামের জন্য এআই সঞ্চয় সহায়ক চালু হয়।" } },
            { year: { en: "May 2026", bn: "মে ২০২৬" }, title: { en: "47,000 Members & Growing", bn: "৪৭,০০০ সদস্য ও ক্রমবর্ধমান" }, desc: { en: "৳2.4 crore saved. Present in all 64 districts. Islamic mode launched nationwide.", bn: "২.৪ কোটি টাকা সঞ্চয় হয়েছে। সব ৬৪ জেলায় উপস্থিত। ইসলামিক মোড জাতীয়ভাবে চালু হয়েছে।" } },
          ],
          ctaTitle: { en: "Join Our Community", bn: "আমাদের কমিউনিটিতে যোগ দিন" },
          ctaDesc: { en: "Start your savings journey today, it takes less than 5 minutes to open a free account.", bn: "আজই আপনার সঞ্চয় যাত্রা শুরু করুন, একটি ফ্রি অ্যাকাউন্ট খুলতে ৫ মিনিটেরও কম সময় লাগে।" },
          ctaButton: { en: "Open Free Account", bn: "ফ্রি অ্যাকাউন্ট খুলুন" },
          ctaButton2: { en: "Talk to Us", bn: "আমাদের সাথে কথা বলুন" },
          footer: { en: "© 2026 Amanah Savings Community. All rights reserved.", bn: "© ২০২৬ আমানাহ সঞ্চয় সম্প্রদায়। সর্বস্বত্ব সংরক্ষিত।" },
        },
        faqPage: {
          heroBadge: { en: "Frequently Asked Questions", bn: "প্রায়শই জিজ্ঞাসিত প্রশ্ন" },
          heroTitle: { en: "Find Answers to Everything", bn: "সবকিছুর উত্তর খুঁজুন" },
          heroDesc: { en: "Browse answers to our most frequently asked questions", bn: "আমাদের সবচেয়ে প্রায়শই জিজ্ঞাসিত প্রশ্নের উত্তর দেখুন" },
          searchPlaceholder: { en: "Search questions...", bn: "প্রশ্ন খুঁজুন..." },
          found: { en: "found", bn: "পাওয়া গেছে" },
          categoryAll: { en: "All", bn: "সব" },
          categoryAccount: { en: "Account", bn: "অ্যাকাউন্ট" },
          categorySavings: { en: "Savings", bn: "সঞ্চয়" },
          categoryPlans: { en: "Plans", bn: "প্ল্যান" },
          categoryCircles: { en: "Circles", bn: "সার্কেল" },
          categoryIslamic: { en: "Islamic", bn: "ইসলামিক" },
          categorySecurity: { en: "Security", bn: "নিরাপত্তা" },
          noQuestions: { en: "No questions found.", bn: "কোন প্রশ্ন পাওয়া যায়নি।" },
          ctaTitle: { en: "Still have questions?", bn: "এখনও প্রশ্ন আছে?" },
          ctaDesc: { en: "Our support team is active Sun-Thu 9am-8pm and on WhatsApp 24/7.", bn: "আমাদের সাপোর্ট টিম সক্রিয় রবি-বৃহ ৯AM-৮PM এবং হোয়াটসঅ্যাপে ২৪/৭।" },
          ctaWhatsApp: { en: "Chat on WhatsApp", bn: "হোয়াটসঅ্যাপে চ্যাট করুন" },
          ctaMessage: { en: "Send a Message", bn: "বার্তা পাঠান" },
          footer: { en: "© 2026 Amanah Savings Community. All rights reserved.", bn: "© ২০২৬ আমানাহ সঞ্চয় সম্প্রদায়। সর্বস্বত্ব সংরক্ষিত।" },
          tagAccount: { en: "Account", bn: "অ্যাকাউন্ট" },
          tagSavings: { en: "Savings", bn: "সঞ্চয়" },
          tagPlans: { en: "Plans", bn: "প্ল্যান" },
          tagCircles: { en: "Circles", bn: "সার্কেল" },
          tagIslamic: { en: "Islamic", bn: "ইসলামিক" },
          tagSecurity: { en: "Security", bn: "নিরাপত্তা" },
        },
        contactPage: {
          heroBadge: { en: "Get in Touch", bn: "যোগাযোগ করুন" },
          heroTitle: { en: "We're Here to Help", bn: "আমরা সাহায্য করতে এখানে আছি" },
          heroDesc: { en: "Have a question about your account, a plan, or just want to say hello? Our team responds within 24 hours.", bn: "আপনার অ্যাকাউন্ট, প্ল্যান বা শুধু হ্যালো বলতে চান? আমাদের টিম ২৪ ঘন্টার মধ্যে উত্তর দেয়।" },
          whatsappLabel: { en: "WhatsApp Support", bn: "হোয়াটসঅ্যাপ সাপোর্ট" },
          whatsappValue: { en: "+880 1700-AMANAH", bn: "+৮৮০ ১৭০০-আমানাহ" },
          whatsappNote: { en: "Fastest response, usually within 1 hour", bn: "দ্রুত প্রতিক্রিয়া, সাধারণত ১ ঘন্টার মধ্যে" },
          whatsappButton: { en: "Chat on WhatsApp", bn: "হোয়াটসঅ্যাপে চ্যাট করুন" },
          whatsappLink: "https://wa.me/8801700262624",
          emailLabel: { en: "Email Support", bn: "ইমেইল সাপোর্ট" },
          emailValue: { en: "support@amanah.com.bd", bn: "support@amanah.com.bd" },
          emailNote: { en: "For account issues, KYC, and billing queries", bn: "অ্যাকাউন্ট সমস্যা, কেওয়াইসি এবং বিলিং প্রশ্নের জন্য" },
          emailButton: { en: "Send Email", bn: "ইমেইল পাঠান" },
          emailLink: "mailto:support@amanah.com.bd",
          addressLabel: { en: "Office Address", bn: "অফিস ঠিকানা" },
          addressValue: { en: "House 12, Road 4, Banani, Dhaka-1213", bn: "বাড়ি ১২, সড়ক ৪, বনানী, ঢাকা-১২১৩" },
          addressNote: { en: "Walk-in appointments available by prior arrangement", bn: "পূর্ব ব্যবস্থায় ওয়াক-ইন অ্যাপয়েন্টমেন্ট পাওয়া যায়" },
          socialLabel: { en: "Social Media", bn: "সোশ্যাল মিডিয়া" },
          socialValue: { en: "@AmanahSavingsBD", bn: "@AmanahSavingsBD" },
          socialNote: { en: "Facebook · Instagram · LinkedIn", bn: "ফেসবুক · ইনস্টাগ্রাম · লিংকডইন" },
          supportHoursTitle: { en: "Support Hours", bn: "সাপোর্ট সময়" },
          sundayThursday: { en: "Sunday - Thursday", bn: "রবিবার - বৃহস্পতিবার" },
          friday: { en: "Friday", bn: "শুক্রবার" },
          saturday: { en: "Saturday", bn: "শনিবার" },
          whatsappUrgent: { en: "WhatsApp (urgent)", bn: "হোয়াটসঅ্যাপ (জরুরি)" },
          formTitle: { en: "Send Us a Message", bn: "আমাদের একটি বার্তা পাঠান" },
          formDesc: { en: "Fill out the form below and we'll get back to you within 24 hours.", bn: "নিচের ফর্মটি পূরণ করুন এবং আমরা ২৪ ঘন্টার মধ্যে আপনার সাথে যোগাযোগ করব।" },
          nameLabel: { en: "Your Name", bn: "আপনার নাম" },
          namePlaceholder: { en: "Fatema Khanam", bn: "ফাতেমা খানম" },
          phoneLabel: { en: "Phone Number", bn: "ফোন নম্বর" },
          phonePlaceholder: { en: "+880 17XXXXXXXX", bn: "+৮৮০ ১৭XXXXXXXX" },
          emailLabel: { en: "Email Address", bn: "ইমেইল ঠিকানা" },
          emailPlaceholder: { en: "fatema@example.com", bn: "fatema@example.com" },
          topicLabel: { en: "Topic", bn: "বিষয়" },
          topicPlaceholder: { en: "- Choose a topic -", bn: "- একটি বিষয় নির্বাচন করুন -" },
          topicAccount: { en: "Account & KYC", bn: "অ্যাকাউন্ট ও কেওয়াইসি" },
          topicDeposit: { en: "Deposit / Withdrawal", bn: "জমা / উত্তোলন" },
          topicPlan: { en: "Plan Upgrade", bn: "প্ল্যান আপগ্রেড" },
          topicCircle: { en: "Savings Circles", bn: "সঞ্চয় সার্কেল" },
          topicTechnical: { en: "Technical Issue", bn: "প্রযুক্তিগত সমস্যা" },
          topicOther: { en: "Other", bn: "অন্যান্য" },
          messageLabel: { en: "Message", bn: "বার্তা" },
          messagePlaceholder: { en: "Write your message...", bn: "আপনার বার্তা লিখুন..." },
          sendButton: { en: "Send Message", bn: "বার্তা পাঠান" },
          sending: { en: "Sending...", bn: "পাঠানো হচ্ছে..." },
          successTitle: { en: "Message Sent!", bn: "বার্তা পাঠানো হয়েছে!" },
          successDesc: { en: "We'll reach out to you within 24 hours. Thank you for contacting us.", bn: "আমরা ২৪ ঘন্টার মধ্যে আপনার সাথে যোগাযোগ করব। আমাদের সাথে যোগাযোগ করার জন্য ধন্যবাদ।" },
          requiredFields: { en: "Name and message are required.", bn: "নাম এবং বার্তা প্রয়োজন।" },
          failedToSend: { en: "Failed to send message. Please try again.", bn: "বার্তা পাঠাতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" },
          footer: { en: "© 2026 Amanah Savings Community. All rights reserved.", bn: "© ২০২৬ আমানাহ সঞ্চয় সম্প্রদায়। সর্বস্বত্ব সংরক্ষিত।" },
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
    
    // Ensure key field is preserved and remove any MongoDB reserved fields
    const cleanUpdates = { ...updates };
    delete cleanUpdates._id; // Remove _id if present to avoid MongoDB error
    
    // Ensure key is always set
    cleanUpdates.key = "cms";
    
    await cmsCollection.updateOne(
      { key: "cms" },
      { $set: { ...cleanUpdates, updatedAt: new Date() } },
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
          paymentMethod: w.paymentMethod,
          goalName: w.goalName,
          goalType: w.goalType,
          userId: w.userId,
          userName:
            user?.fullName ||
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
            "Unknown", // ✅
          userPhone: user?.phone,
          phone: user?.phone,
          reason: w.reason,
          remarks: w.remarks,
          paymentDetails: w.paymentDetails,
          isReferralBonus: w.isReferralBonus,
          isCircleWithdrawal: w.isCircleWithdrawal,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
          approvedAt: w.approvedAt,
          processedAt: w.processedAt,
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
          pending: pendingDeposits + pendingWithdrawals,
          approved: approvedDeposits + completedWithdrawals,
          totalDeposits: totalDepositAmount,
          totalWithdrawals: totalWithdrawalAmount,
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
