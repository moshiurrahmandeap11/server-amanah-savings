// controllers/auth/auth.controller.js
import { sendOtpEmail, sendPasswordResetOtpEmail } from "../../utils/emailService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { ObjectId } from "mongodb";

import { db } from "../../database/db.js";
import { deleteFromCloudinary } from "../../middlewares/upload.js";

// Helper function to generate JWT
const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    phone: user.phone,
    role: user.role || "user",
    plan: user.selectedPlan || "bronze",
    level: user.level || 1,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// Helper to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Helper to sanitize user data for frontend - prevents null/undefined/NaN display issues
const sanitizeUserResponse = (user) => {
  if (!user) return null;
  
  const safeString = (val) => val || "";
  const safeNumber = (val) => Number(val) || 0;
  const safeBool = (val) => Boolean(val);
  const safeDate = (val) => val || null;
  const safeObject = (val) => val || null;
  
  return {
    id: user._id,
    firstName: safeString(user.firstName),
    lastName: safeString(user.lastName),
    fullName: safeString(user.fullName) || `${safeString(user.firstName)} ${safeString(user.lastName)}`.trim() || "User",
    role: safeString(user.role) || "user",
    phone: safeString(user.phone),
    email: safeString(user.email),
    selectedPlan: safeString(user.selectedPlan) || "bronze",
    customPlanName: safeString(user.customPlanName) || null,
    billingCycle: safeString(user.billingCycle) || "monthly",
    planFee: safeNumber(user.planFee),
    planActive: safeBool(user.planActive),
    planExpiry: safeDate(user.planExpiry) || null,
    kyc: {
      nidNumber: safeString(user.kyc?.nidNumber) || null,
      nidFrontImage: safeString(user.kyc?.nidFrontImage) || null,
      nidBackImage: safeString(user.kyc?.nidBackImage) || null,
      birthCertificateImage: safeString(user.kyc?.birthCertificateImage) || null,
      selfieImage: safeString(user.kyc?.selfieImage) || null,
      passportImage: safeString(user.kyc?.passportImage) || null,
      status: safeString(user.kyc?.status) || "pending",
      submittedAt: safeDate(user.kyc?.submittedAt) || null,
      verifiedAt: safeDate(user.kyc?.verifiedAt) || null,
      verifiedBy: safeString(user.kyc?.verifiedBy) || null,
    },
    address: safeObject(user.address) || null,
    nominee: safeObject(user.nominee) || null,
    paymentMethod: safeString(user.paymentMethod) || null,
    paymentDetails: safeObject(user.paymentDetails) || null,
    profilePicture: safeString(user.profilePicture) || null,
    profilePicturePublicId: safeString(user.profilePicturePublicId) || null,
    referralCode: safeString(user.referralCode) || null,
    referredBy: safeString(user.referredBy) || null,
    totalReferralBonus: safeNumber(user.totalReferralBonus),
    totalSaved: safeNumber(user.totalSaved),
    totalDeposits: safeNumber(user.totalDeposits),
    totalWithdrawals: safeNumber(user.totalWithdrawals),
    streak: safeNumber(user.streak),
    longestStreak: safeNumber(user.longestStreak),
    lastDepositDate: safeDate(user.lastDepositDate) || null,
    level: safeNumber(user.level) || 1,
    xp: safeNumber(user.xp) || 0,
    nextLevelXp: safeNumber(user.nextLevelXp) || 100,
    achievements: Array.isArray(user.achievements) ? user.achievements : [],
    badges: Array.isArray(user.badges) ? user.badges : [],
    goals: Array.isArray(user.goals) ? user.goals : [],
    accountActive: safeBool(user.accountActive),
    isBanned: safeBool(user.isBanned),
    isSuspended: safeBool(user.isSuspended),
    createdAt: safeDate(user.createdAt) || null,
    updatedAt: safeDate(user.updatedAt) || null,
  };
};

// Plan configuration
const PLAN_CONFIG = {
  bronze: { monthlyFee: 0, yearlyFee: 0, maxDeposit: 10000, minMonthly: 500, maxMonthly: 2000 },
  silver: { monthlyFee: 199, yearlyFee: 159, maxDeposit: 25000, minMonthly: 2000, maxMonthly: 10000 },
  gold: { monthlyFee: 499, yearlyFee: 399, maxDeposit: 100000, minMonthly: 10000, maxMonthly: 50000 },
  platinum: { monthlyFee: 999, yearlyFee: 799, maxDeposit: 500000, minMonthly: 50000, maxMonthly: Infinity },
  custom: { monthlyFee: 0, yearlyFee: 0, maxDeposit: 10000, minMonthly: 0, maxMonthly: Infinity },
};

// ==================== REGISTRATION ====================
export const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      password,
      dob,
      gender,
      occupation,
      income,
      village,
      postOffice,
      postCode,
      division,
      district,
      upazila,
      selectedPlan,
      customPlanName,
      billingCycle,
      planFee,
      goalType,
      customGoalName,
      targetAmount,
      monthlyDeposit,
      duration,
      referralCode,
      kyc,
      nominee,
      paymentMethod,
      paymentDetails,
    } = req.body;

    const usersCollection = db.collection("users");

    // Validate required fields
    const requiredFields = [];
    if (!firstName) requiredFields.push("firstName");
    if (!lastName) requiredFields.push("lastName");
    if (!phone) requiredFields.push("phone");
    if (!email) requiredFields.push("email");
    if (!password) requiredFields.push("password");
    if (!selectedPlan) requiredFields.push("selectedPlan");

    if (requiredFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${requiredFields.join(", ")}`,
      });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or phone already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate referral code
    const generatedReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Handle referredBy
    let referredBy = null;
    if (referralCode) {
      const referrer = await usersCollection.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        referredBy = referrer._id.toString();
      }
    }

    // Calculate plan expiry
    const planExpiry = billingCycle === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create user document
    const newUser = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      phone,
      email,
      password: hashedPassword,
      dob: dob || null,
      gender: gender || null,
      occupation: occupation || null,
      income: income || null,
      address: {
        division: division || null,
        district: district || null,
        upazila: upazila || null,
        village: village || null,
        postOffice: postOffice || null,
        postCode: postCode || null,
      },
      selectedPlan: selectedPlan || "bronze",
      customPlanName: customPlanName || null,
      billingCycle: billingCycle || "monthly",
      planFee: planFee ? parseInt(planFee) : 0,
      planActive: true,
      planExpiry,
      kyc: {
        nidNumber: kyc?.nidNumber || null,
        nidFrontImage: kyc?.nidFrontImage || null,
        nidBackImage: kyc?.nidBackImage || null,
        birthCertificateImage: kyc?.birthCertificateImage || null,
        selfieImage: kyc?.selfieImage || null,
        passportImage: kyc?.passportImage || null,
        status: "pending",
        submittedAt: null,
        verifiedAt: null,
        verifiedBy: null,
      },
      nominee: nominee || null,
      paymentMethod: paymentMethod || null,
      paymentDetails: paymentDetails || null,
      profilePicture: null,
      profilePicturePublicId: null,
      referralCode: generatedReferralCode,
      referredBy,
      totalReferralBonus: 0,
      totalSaved: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      streak: 0,
      longestStreak: 0,
      lastDepositDate: null,
      level: 1,
      xp: 0,
      nextLevelXp: 100,
      achievements: [],
      badges: [],
      goals: [],
      notifications: [],
      unreadNotifications: 0,
      accountActive: true,
      isBanned: false,
      isSuspended: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    // Generate token
    const token = generateToken({ ...newUser, _id: result.insertedId });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        token,
        user: sanitizeUserResponse({ ...newUser, _id: result.insertedId }),
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

// ==================== LOGIN ====================
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Identifier and password are required",
      });
    }

    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is active
    if (!user.accountActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      });
    }

    // Check if account is banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Account is banned. Please contact support.",
      });
    }

    // Check if account is suspended
    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: "Account is suspended. Please contact support.",
      });
    }

    // Update last login
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Generate token
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: sanitizeUserResponse(user),
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

// ==================== GET CURRENT USER ====================
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, pin: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeUserResponse(user),
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user",
    });
  }
};

// ==================== GET USER BY ID ====================
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, pin: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeUserResponse(user),
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user",
    });
  }
};

// ==================== UPDATE PROFILE ====================
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      email,
      dob,
      gender,
      occupation,
      income,
      village,
      postOffice,
      postCode,
      division,
      district,
      upazila,
    } = req.body;

    const usersCollection = db.collection("users");

    const updateData = {
      updatedAt: new Date(),
    };

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (firstName || lastName)
      updateData.fullName =
        `${firstName || req.user.firstName} ${lastName || req.user.lastName}`.trim();
    if (email) updateData.email = email;
    if (dob) updateData.dob = dob;
    if (gender) updateData.gender = gender;
    if (occupation) updateData.occupation = occupation;
    if (income) updateData.income = income;
    if (village) updateData.village = village;
    if (postOffice) updateData.postOffice = postOffice;
    if (postCode) updateData.postCode = postCode;
    if (division) updateData.division = division;
    if (district) updateData.district = district;
    if (upazila) updateData.upazila = upazila;

    if (division || district || upazila || village || postOffice || postCode) {
      updateData.address = {
        division: division || req.user.division,
        district: district || req.user.district,
        upazila: upazila || req.user.upazila,
        village: village || req.user.village,
        postOffice: postOffice || req.user.postOffice,
        postCode: postCode || req.user.postCode,
      };
    }

    if (req.file) {
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (user?.profilePicturePublicId) {
        try {
          await deleteFromCloudinary(user.profilePicturePublicId, "image");
        } catch (err) {
          console.error("Failed to delete old profile picture:", err);
        }
      }

      updateData.profilePicture = req.file.path;
      updateData.profilePicturePublicId = req.file.filename;
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, pin: 0 } },
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: sanitizeUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
};

// ==================== CHANGE PASSWORD ====================
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to change password",
    });
  }
};

// ==================== CHANGE PIN ====================
export const changePin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({
        success: false,
        message: "Current PIN and new PIN are required",
      });
    }

    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 6 digits",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPinValid = await bcrypt.compare(currentPin, user.pin);

    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: "Current PIN is incorrect",
      });
    }

    const hashedPin = await bcrypt.hash(newPin, 10);

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { pin: hashedPin, updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "PIN changed successfully",
    });
  } catch (error) {
    console.error("Change PIN error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to change PIN",
    });
  }
};

// ==================== UPDATE NOMINEE ====================
export const updateNominee = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nominee } = req.body;

    const usersCollection = db.collection("users");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { nominee, updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "Nominee updated successfully",
    });
  } catch (error) {
    console.error("Update nominee error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update nominee",
    });
  }
};

// ==================== UPDATE PAYMENT METHOD ====================
export const updatePaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentMethod, paymentDetails } = req.body;

    const usersCollection = db.collection("users");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { paymentMethod, paymentDetails, updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "Payment method updated successfully",
    });
  } catch (error) {
    console.error("Update payment method error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update payment method",
    });
  }
};

// ==================== UPLOAD PROFILE PICTURE ====================
export const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (user?.profilePicturePublicId) {
      try {
        await deleteFromCloudinary(user.profilePicturePublicId, "image");
      } catch (err) {
        console.error("Failed to delete old profile picture:", err);
      }
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          profilePicture: req.file.path,
          profilePicturePublicId: req.file.filename,
          updatedAt: new Date(),
        },
      }
    );

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, pin: 0 } }
    );

    return res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: sanitizeUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload profile picture",
    });
  }
};

// ==================== DELETE PROFILE PICTURE ====================
export const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (user?.profilePicturePublicId) {
      try {
        await deleteFromCloudinary(user.profilePicturePublicId, "image");
      } catch (err) {
        console.error("Failed to delete profile picture from Cloudinary:", err);
      }
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          profilePicture: null,
          profilePicturePublicId: null,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Profile picture deleted successfully",
    });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete profile picture",
    });
  }
};

// ==================== UPDATE PLAN ====================
export const updatePlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { selectedPlan, billingCycle } = req.body;

    // Validate plan
    const validPlans = ["bronze", "silver", "gold", "platinum", "custom"];
    if (!selectedPlan || !validPlans.includes(selectedPlan.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan. Must be one of: ${validPlans.join(", ")}`,
      });
    }

    // Validate billing cycle
    const validCycles = ["monthly", "yearly"];
    if (!billingCycle || !validCycles.includes(billingCycle.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing cycle. Must be 'monthly' or 'yearly'",
      });
    }

    const planKey = selectedPlan.toLowerCase();
    const cycleKey = billingCycle.toLowerCase();
    const planConfig = PLAN_CONFIG[planKey];

    if (!planConfig) {
      return res.status(400).json({
        success: false,
        message: "Plan configuration not found",
      });
    }

    // Calculate fee and expiry
    const planFee = cycleKey === "yearly" ? planConfig.yearlyFee : planConfig.monthlyFee;
    const planExpiry = cycleKey === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const usersCollection = db.collection("users");

    const updateData = {
      selectedPlan: planKey,
      billingCycle: cycleKey,
      planFee,
      planActive: true,
      planExpiry,
      updatedAt: new Date(),
    };

    // If custom plan, keep existing customPlanName or clear it
    if (planKey === "custom") {
      updateData.planFee = 0;
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, pin: 0 } }
    );

    // Generate new token with updated plan
    const token = generateToken(updatedUser);

    return res.status(200).json({
      success: true,
      message: `Plan upgraded to ${planKey.charAt(0).toUpperCase() + planKey.slice(1)} (${cycleKey}) successfully`,
      data: {
        user: sanitizeUserResponse(updatedUser),
        token,
      },
    });
  } catch (error) {
    console.error("Update plan error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update plan",
    });
  }
};

// ==================== DELETE ACCOUNT ====================
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const usersCollection = db.collection("users");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { accountActive: false, updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete account",
    });
  }
};

// ==================== EMAIL OTP ====================
export const sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const usersCollection = db.collection("users");
    await usersCollection.updateOne(
      { email },
      { $set: { emailOtp: otp, emailOtpExpiry: otpExpiry } },
      { upsert: true }
    );

    await sendOtpEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Send email OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
};

// ==================== VERIFY EMAIL OTP ====================
export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ email });

    if (!user || user.emailOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (new Date() > new Date(user.emailOtpExpiry)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    await usersCollection.updateOne(
      { email },
      { $set: { emailVerified: true, emailOtp: null, emailOtpExpiry: null } }
    );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify OTP",
    });
  }
};

// ==================== PASSWORD RESET ====================
export const sendPasswordResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await usersCollection.updateOne(
      { email },
      { $set: { passwordResetOtp: otp, passwordResetOtpExpiry: otpExpiry } }
    );

    await sendPasswordResetOtpEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent successfully",
    });
  } catch (error) {
    console.error("Send password reset OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send password reset OTP",
    });
  }
};

// ==================== RESET PASSWORD ====================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ email });

    if (!user || user.passwordResetOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (new Date() > new Date(user.passwordResetOtpExpiry)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await usersCollection.updateOne(
      { email },
      { $set: { password: hashedPassword, passwordResetOtp: null, passwordResetOtpExpiry: null } }
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reset password",
    });
  }
};

// ==================== VALIDATE REFERRAL CODE ====================
export const validateReferralCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ referralCode: code.toUpperCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid referral code",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Referral code is valid",
      data: {
        referrerName: user.fullName || `${user.firstName} ${user.lastName}`,
      },
    });
  } catch (error) {
    console.error("Validate referral code error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to validate referral code",
    });
  }
};

// ==================== UPLOAD KYC DOCUMENTS ====================
export const uploadKycDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documents } = req.body;

    const usersCollection = db.collection("users");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "kyc.nidNumber": documents?.nidNumber || null,
          "kyc.nidFrontImage": documents?.nidFrontImage || null,
          "kyc.nidBackImage": documents?.nidBackImage || null,
          "kyc.birthCertificateImage": documents?.birthCertificateImage || null,
          "kyc.selfieImage": documents?.selfieImage || null,
          "kyc.passportImage": documents?.passportImage || null,
          "kyc.status": "pending",
          "kyc.submittedAt": new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "KYC documents uploaded successfully",
    });
  } catch (error) {
    console.error("Upload KYC documents error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload KYC documents",
    });
  }
};

// ==================== SEARCH USER BY PHONE ====================
export const searchUserByPhone = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne(
      { phone: { $regex: escapeRegex(phone), $options: "i" } },
      { projection: { password: 0, pin: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        profilePicture: user.profilePicture,
        avatar: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Search user error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to search user",
    });
  }
};
