import { sendOtpEmail } from "../../utils/emailService.js";
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

// ==================== REGISTRATION ====================

// In auth.controller.js - Update the register function

// auth.controller.js - Updated register function with better debugging

export const register = async (req, res) => {
  try {
    console.log("=== Received Registration Data ===");
    console.log("Request Body:", req.body);
    console.log("KYC Images Check:", {
      nidFront: req.body.nidFrontImage ? "Present (length: " + req.body.nidFrontImage.length + ")" : "Missing",
      nidBack: req.body.nidBackImage ? "Present (length: " + req.body.nidBackImage.length + ")" : "Missing",
      selfie: req.body.selfieImage ? "Present (length: " + req.body.selfieImage.length + ")" : "Missing",
      birthCert: req.body.birthCertificateImage ? "Present" : "Missing",
      passport: req.body.passportImage ? "Present" : "Missing",
    });

    const {
      // Step 1 - Account
      firstName,
      lastName,
      phone,
      email,
      password,

      // Step 4 - Personal Info
      dob,
      gender,
      division,
      district,
      upazila,
      occupation,
      income,
      referralCode,
      village,
      postOffice,
      postCode,

      // Step 5 - Nominee
      nomineeFirstName,
      nomineeLastName,
      nomineeRelation,
      nomineePhone,
      nomineeNid,
      nomineeShare,

      // Step 6 - Plan & Goal
      selectedPlan,
      goalType,
      targetAmount,
      monthlyDeposit,
      duration,

      // Step 7 - PIN
      pin,

      // Step 8 - KYC
      nidNumber,
      nidFrontImage,
      nidBackImage,
      birthCertificateImage,
      selfieImage,
      passportImage,
      kycConsent,
      kycSkipped,
      islamicMode,

      // Step 9 - Payment
      paymentMethod,
      walletNumber,
      walletName,
      bankName,
      bankAccNum,
      bankAccName,
      bankBranch,
      bankRouting,

      // Agreements
      terms,
      withdrawalPolicy,
      marketing,
    } = req.body;

    // Required fields validation - UPDATED
    const requiredFields = [];
    if (!firstName) requiredFields.push("firstName");
    if (!phone) requiredFields.push("phone");
    if (!password) requiredFields.push("password");
    if (!dob) requiredFields.push("dob");
    if (!occupation) requiredFields.push("occupation");
    if (!income) requiredFields.push("income");
    if (!nomineeFirstName) requiredFields.push("nomineeFirstName");
    if (!nomineeRelation) requiredFields.push("nomineeRelation");
    if (!nomineePhone) requiredFields.push("nomineePhone");
    if (!selectedPlan) requiredFields.push("selectedPlan");
    if (!pin) requiredFields.push("pin");
    if (!terms) requiredFields.push("terms");
    if (!withdrawalPolicy) requiredFields.push("withdrawalPolicy");
    if (!paymentMethod) requiredFields.push("paymentMethod");

    // KYC validation - UPDATED: Check if kycSkipped is false or undefined
    const isKycSkipped = kycSkipped === true || kycSkipped === "true";
    
    console.log("KYC Skipped:", isKycSkipped);

    if (!isKycSkipped) {
      // Check if KYC consent is given
      if (!kycConsent) requiredFields.push("kycConsent");
      
      // Check NID or Birth Certificate
      const hasNidFront = nidFrontImage && nidFrontImage.trim() !== '';
      const hasNidBack = nidBackImage && nidBackImage.trim() !== '';
      const hasBirthCert = birthCertificateImage && birthCertificateImage.trim() !== '';
      
      console.log("KYC Document Check:", { hasNidFront, hasNidBack, hasBirthCert });
      
      if (!hasNidFront && !hasNidBack && !hasBirthCert) {
        requiredFields.push("nidFrontImage or birthCertificateImage");
      }
      
      // Check Selfie
      const hasSelfie = selfieImage && selfieImage.trim() !== '';
      console.log("Selfie Check:", hasSelfie);
      
      if (!hasSelfie) {
        requiredFields.push("selfieImage");
      }
    }

    if (requiredFields.length > 0) {
      console.log("Missing required fields:", requiredFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${requiredFields.join(", ")}`,
        requiredFields,
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    // PIN validation
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: "PIN must be 6 digits",
      });
    }

    // Payment method specific validation
    if (paymentMethod !== "bank") {
      if (!walletNumber) {
        return res.status(400).json({
          success: false,
          message: "Wallet number is required for mobile banking",
        });
      }
      if (!walletName) {
        return res.status(400).json({
          success: false,
          message: "Wallet account holder name is required",
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
      if (!bankAccNum) {
        return res.status(400).json({
          success: false,
          message: "Bank account number is required",
        });
      }
      if (!bankAccName) {
        return res.status(400).json({
          success: false,
          message: "Bank account holder name is required",
        });
      }
    }

    const usersCollection = db.collection("users");

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ phone }, email ? { email } : null].filter(Boolean),
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          existingUser.phone === phone
            ? "Phone number already registered"
            : "Email already registered",
      });
    }

    // Hash password and PIN
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create full name
    const fullName = `${firstName} ${lastName || ""}`.trim();

    // Generate referral code
    const userReferralCode = `${firstName.substring(0, 3).toUpperCase()}${Math.floor(Math.random() * 10000)}`;

    // Check referral code
    let referrerId = null;
    if (referralCode) {
      const referrer = await usersCollection.findOne({
        referralCode: referralCode.toUpperCase(),
      });
      if (referrer) {
        referrerId = referrer._id;
      }
    }

    // Determine KYC status
    let kycStatus = "pending";
    if (isKycSkipped) {
      kycStatus = "skipped";
    }

    // Create user document
    const newUser = {
      // Personal Information
      firstName,
      lastName: lastName || null,
      fullName,
      phone,
      email: email || null,
      password: hashedPassword,
      pin: hashedPin,

      // Personal Details
      dob,
      gender: gender || null,
      division,
      district,
      upazila: upazila || null,
      occupation,
      income,
      village: village || null,
      postOffice: postOffice || null,
      postCode: postCode || null,

      // Address
      address: {
        division,
        district,
        upazila: upazila || null,
        village: village || null,
        postOffice: postOffice || null,
        postCode: postCode || null,
      },

      // Nominee
      nominee: {
        firstName: nomineeFirstName,
        lastName: nomineeLastName || null,
        fullName: `${nomineeFirstName} ${nomineeLastName || ""}`.trim(),
        relation: nomineeRelation,
        phone: nomineePhone,
        nid: nomineeNid || null,
        share: parseInt(nomineeShare) || 100,
      },

      // Plan & Goal
      selectedPlan,
      goal: {
        type: goalType || null,
        targetAmount: targetAmount ? parseInt(targetAmount) : null,
        monthlyDeposit: monthlyDeposit ? parseInt(monthlyDeposit) : null,
        duration: duration ? parseInt(duration) : null,
        currentSaved: 0,
        progress: 0,
      },

      // KYC with Documents
      kyc: {
        nidNumber: nidNumber || null,
        nidFrontImage: nidFrontImage || null,
        nidBackImage: nidBackImage || null,
        birthCertificateImage: birthCertificateImage || null,
        selfieImage: selfieImage || null,
        passportImage: passportImage || null,
        kycConsent: kycConsent || false,
        status: kycStatus,
        submittedAt: new Date(),
        verifiedAt: null,
        rejectionReason: null,
        islamicMode: islamicMode || false,
        skipped: isKycSkipped || false,
      },

      // Payment Method
      paymentMethod,
      paymentDetails:
        paymentMethod === "bank"
          ? {
              bankName,
              accountNumber: bankAccNum,
              accountName: bankAccName,
              branch: bankBranch || null,
              routingNumber: bankRouting || null,
            }
          : {
              walletNumber,
              accountName: walletName,
            },

      // Profile Picture
      profilePicture: null,
      profilePicturePublicId: null,

      // Referral
      referralCode: userReferralCode,
      referredBy: referrerId,
      referralBonusApplied: false,

      // Settings
      marketing: marketing || false,
      termsAccepted: terms,
      withdrawalPolicyAccepted: withdrawalPolicy,

      // Account Status
      role: "user",
      level: 1,
      streak: 0,
      totalSaved: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,

      // Verification Flags
      phoneVerified: true,
      emailVerified: email ? false : true,
      kycCompleted: false,
      accountActive: false,

      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    };

    console.log("Creating user with KYC data:", {
      nidFront: newUser.kyc.nidFrontImage ? "Present" : "Missing",
      nidBack: newUser.kyc.nidBackImage ? "Present" : "Missing",
      selfie: newUser.kyc.selfieImage ? "Present" : "Missing",
      kycStatus: newUser.kyc.status,
    });

    const result = await usersCollection.insertOne(newUser);
    const user = { ...newUser, _id: result.insertedId };

    // Generate JWT token
    const token = generateToken(user);

    // Remove sensitive data
    delete user.password;
    delete user.pin;

    return res.status(201).json({
      success: true,
      message: "Registration successful!",
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          phone: user.phone,
          email: user.email,
          selectedPlan: user.selectedPlan,
          kycStatus: user.kyc.status,
          accountActive: user.accountActive,
          referralCode: user.referralCode,
          createdAt: user.createdAt,
        },
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

// Add this function to handle KYC document uploads separately (optional)
export const uploadKycDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      nidNumber,
      nidFrontImage,
      nidBackImage,
      birthCertificateImage,
      selfieImage,
      passportImage,
      kycConsent,
    } = req.body;

    const usersCollection = db.collection("users");

    const updateData = {
      $set: {
        "kyc.nidNumber": nidNumber || null,
        "kyc.nidFrontImage": nidFrontImage || null,
        "kyc.nidBackImage": nidBackImage || null,
        "kyc.birthCertificateImage": birthCertificateImage || null,
        "kyc.selfieImage": selfieImage || null,
        "kyc.passportImage": passportImage || null,
        "kyc.kycConsent": kycConsent || false,
        "kyc.status": "pending",
        "kyc.submittedAt": new Date(),
        updatedAt: new Date(),
      },
    };

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      updateData,
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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

// ==================== LOGIN ====================

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone/Email and password are required",
      });
    }

    const usersCollection = db.collection("users");
    const loginHistoryCollection = db.collection("login_history");
    const sessionsCollection = db.collection("user_sessions");

    // Find user by phone or email
    const user = await usersCollection.findOne({
      $or: [{ phone: identifier }, { email: identifier }],
    });

    if (!user) {
      // Log failed login attempt
      await loginHistoryCollection.insertOne({
        userId: null,
        identifier,
        success: false,
        failureReason: "User not found",
        ip,
        userAgent,
        loginTime: new Date(),
      });

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.password) {
      await loginHistoryCollection.insertOne({
        userId: user._id,
        identifier,
        success: false,
        failureReason: "Social login account",
        ip,
        userAgent,
        loginTime: new Date(),
      });

      return res.status(401).json({
        success: false,
        message:
          "This account uses social login. Please login with Google/Facebook.",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await loginHistoryCollection.insertOne({
        userId: user._id,
        identifier,
        success: false,
        failureReason: "Invalid password",
        ip,
        userAgent,
        loginTime: new Date(),
      });

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken(user);

    // Get device info
    const deviceInfo = getDeviceInfo(userAgent);

    // Get location (you can integrate with IP geolocation API)
    const location = await getLocationFromIP(ip);

    // Save session
    const session = {
      userId: user._id,
      token,
      device: deviceInfo.device,
      deviceName: deviceInfo.deviceName,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ip,
      location: location,
      isActive: true,
      lastActivity: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    await sessionsCollection.insertOne(session);

    // Log successful login
    await loginHistoryCollection.insertOne({
      userId: user._id,
      identifier,
      success: true,
      device: deviceInfo.device,
      deviceName: deviceInfo.deviceName,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ip,
      location: location,
      userAgent,
      loginTime: new Date(),
    });

    // Update user's last login
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          lastLogin: new Date(),
          lastLoginIp: ip,
          lastLoginDevice: deviceInfo.device,
          updatedAt: new Date(),
        },
      },
    );

    // Remove sensitive data
    delete user.password;
    delete user.pin;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          phone: user.phone,
          email: user.email,
          selectedPlan: user.selectedPlan,
          kycStatus: user.kyc.status,
          accountActive: user.accountActive,
          level: user.level,
          streak: user.streak,
          totalSaved: user.totalSaved,
          referralCode: user.referralCode,
          profilePicture: user.profilePicture,
        },
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

// Helper functions for device detection
const getDeviceInfo = (userAgent) => {
  const ua = userAgent || "";
  let device = "Desktop";
  let deviceName = "Computer";
  let browser = "Unknown";
  let os = "Unknown";

  // Detect device type
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
    device = "Mobile";
    if (/iPhone/i.test(ua)) deviceName = "iPhone";
    else if (/iPad/i.test(ua)) deviceName = "iPad";
    else if (/Android/i.test(ua)) deviceName = "Android Phone";
    else deviceName = "Mobile Device";
  } else if (/Tablet/i.test(ua)) {
    device = "Tablet";
    deviceName = "Tablet";
  } else if (/Windows/i.test(ua)) {
    device = "Desktop";
    deviceName = "Windows PC";
  } else if (/Mac/i.test(ua)) {
    device = "Desktop";
    deviceName = "Mac";
  }

  // Detect browser
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Opera|OPR/i.test(ua)) browser = "Opera";

  // Detect OS
  if (/Windows NT 10.0/i.test(ua)) os = "Windows 10";
  else if (/Windows NT 6.1/i.test(ua)) os = "Windows 7";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iOS|iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return { device, deviceName, browser, os };
};

// Get location from IP (simplified - you can integrate with ipapi or similar)
const getLocationFromIP = async (ip) => {
  // For now, return a default location
  // You can integrate with ipapi.co or similar service
  return "Dhaka, Bangladesh";
};

// ==================== GET CURRENT USER ====================

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, pin: 0 } },
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
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        email: user.email,
        selectedPlan: user.selectedPlan,
        kycStatus: user.kyc.status,
        accountActive: user.accountActive,
        level: user.level,
        streak: user.streak,
        totalSaved: user.totalSaved,
        referralCode: user.referralCode,
        profilePicture: user.profilePicture,
        dob: user.dob,
        gender: user.gender,
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        occupation: user.occupation,
        income: user.income,
        village: user.village,
        postOffice: user.postOffice,
        postCode: user.postCode,
        nominee: user.nominee,
        paymentMethod: user.paymentMethod,
        paymentDetails: user.paymentDetails,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get user",
    });
  }
};

// ==================== OTP SERVICES ====================

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

    const otpCollection = db.collection("otps");

    await otpCollection.deleteMany({ email, type: "email_verification" });

    await otpCollection.insertOne({
      email,
      otp,
      type: "email_verification",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send real email via Nodemailer
    const emailResult = await sendOtpEmail(email, otp);
    
    if (!emailResult.success) {
      console.error("Failed to send email:", emailResult.error);
      // Still return OTP in dev mode so registration can proceed
    }

    return res.status(200).json({
      success: true,
      message: "Email OTP sent successfully",
      ...(process.env.NODE_ENV !== "production" && { otp }),
    });
  } catch (error) {
    console.error("Send email OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send email OTP",
    });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const otpCollection = db.collection("otps");

    const otpRecord = await otpCollection.findOne({
      email,
      otp,
      type: "email_verification",
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    await otpCollection.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Email verification failed",
    });
  }
};

// ==================== PROFILE & SETTINGS ====================

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
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
};

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
        message: "New password must be at least 8 characters",
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

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses social login. No password to change.",
      });
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      },
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
        message: "PIN must be 6 digits",
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

    const isValidPin = await bcrypt.compare(currentPin, user.pin);
    if (!isValidPin) {
      return res.status(401).json({
        success: false,
        message: "Current PIN is incorrect",
      });
    }

    const hashedPin = await bcrypt.hash(newPin, 10);

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          pin: hashedPin,
          updatedAt: new Date(),
        },
      },
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

export const updateNominee = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      nomineeFirstName,
      nomineeLastName,
      nomineeRelation,
      nomineePhone,
      nomineeNid,
      nomineeShare,
    } = req.body;

    const usersCollection = db.collection("users");

    const updateData = {
      "nominee.firstName": nomineeFirstName,
      "nominee.lastName": nomineeLastName || null,
      "nominee.fullName": `${nomineeFirstName} ${nomineeLastName || ""}`.trim(),
      "nominee.relation": nomineeRelation,
      "nominee.phone": nomineePhone,
      "nominee.nid": nomineeNid || null,
      "nominee.share": parseInt(nomineeShare) || 100,
      updatedAt: new Date(),
    };

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

export const updatePaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      paymentMethod,
      walletNumber,
      walletName,
      bankName,
      bankAccNum,
      bankAccName,
      bankBranch,
      bankRouting,
    } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    const usersCollection = db.collection("users");

    const updateData = {
      paymentMethod,
      updatedAt: new Date(),
    };

    if (paymentMethod !== "bank") {
      if (!walletNumber || !walletName) {
        return res.status(400).json({
          success: false,
          message: "Wallet number and account name are required",
        });
      }
      updateData.paymentDetails = {
        walletNumber,
        accountName: walletName,
      };
    } else {
      if (!bankName || !bankAccNum || !bankAccName) {
        return res.status(400).json({
          success: false,
          message: "Bank name, account number, and account name are required",
        });
      }
      updateData.paymentDetails = {
        bankName,
        accountNumber: bankAccNum,
        accountName: bankAccName,
        branch: bankBranch || null,
        routingNumber: bankRouting || null,
      };
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
      },
    );

    return res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: {
        url: req.file.path,
        publicId: req.file.filename,
      },
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload profile picture",
    });
  }
};

export const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user?.profilePicturePublicId) {
      return res.status(404).json({
        success: false,
        message: "No profile picture found",
      });
    }

    await deleteFromCloudinary(user.profilePicturePublicId, "image");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          profilePicture: null,
          profilePicturePublicId: null,
          updatedAt: new Date(),
        },
      },
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

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.profilePicturePublicId) {
      try {
        await deleteFromCloudinary(user.profilePicturePublicId, "image");
      } catch (err) {
        console.error("Failed to delete profile picture:", err);
      }
    }

    await usersCollection.deleteOne({ _id: new ObjectId(userId) });

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

// Get active sessions
export const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user.id;

    const sessionsCollection = db.collection("user_sessions");

    const sessions = await sessionsCollection
      .find({
        userId: new ObjectId(userId),
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
      .sort({ lastActivity: -1 })
      .toArray();

    // Format sessions for frontend
    const formattedSessions = sessions.map((session) => ({
      id: session._id,
      device: getDeviceIcon(session.device),
      deviceType: session.device,
      name: session.deviceName || `${session.device} Device`,
      location: session.location || "Unknown Location",
      ip: session.ip,
      time: getTimeAgo(session.lastActivity),
      isCurrent: session.token === req.headers.authorization?.split(" ")[1],
      lastActivity: session.lastActivity,
    }));

    return res.status(200).json({
      success: true,
      data: formattedSessions,
    });
  } catch (error) {
    console.error("Get active sessions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch active sessions",
    });
  }
};

// Revoke a session (logout from specific device)
export const revokeSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const sessionsCollection = db.collection("user_sessions");

    const session = await sessionsCollection.findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(userId),
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Don't allow revoking current session
    const currentToken = req.headers.authorization?.split(" ")[1];
    if (session.token === currentToken) {
      return res.status(400).json({
        success: false,
        message: "Cannot revoke current session. Use logout instead.",
      });
    }

    await sessionsCollection.updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          isActive: false,
          revokedAt: new Date(),
          revokedBy: new ObjectId(userId),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error) {
    console.error("Revoke session error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to revoke session",
    });
  }
};

// Get login history
export const getLoginHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const loginHistoryCollection = db.collection("login_history");

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const history = await loginHistoryCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await loginHistoryCollection.countDocuments({
      userId: new ObjectId(userId),
    });

    const formattedHistory = history.map((entry) => ({
      id: entry._id,
      success: entry.success,
      name: entry.success ? "Successful Login" : "Failed Login Attempt",
      time: formatLoginTime(entry.loginTime),
      device: entry.device,
      location: entry.location,
      ip: entry.ip,
    }));

    return res.status(200).json({
      success: true,
      data: {
        history: formattedHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get login history error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch login history",
    });
  }
};

// Helper functions
const getDeviceIcon = (device) => {
  const deviceLower = device?.toLowerCase() || "";
  if (deviceLower.includes("android")) return "📱";
  if (deviceLower.includes("ios") || deviceLower.includes("iphone"))
    return "🍎";
  if (deviceLower.includes("windows")) return "💻";
  if (deviceLower.includes("mac")) return "🖥️";
  if (deviceLower.includes("linux")) return "🐧";
  return "🌐";
};

const getTimeAgo = (date) => {
  if (!date) return "Unknown";
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Active now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(date).toLocaleDateString();
};

const formatLoginTime = (date) => {
  if (!date) return "Unknown";
  const now = new Date();
  const loginDate = new Date(date);
  const diff = now - loginDate;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = loginDate.getHours();
  const minutes = loginDate.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;

  if (days === 0) {
    return `Today, ${formattedHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  } else if (days === 1) {
    return `Yesterday, ${formattedHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  } else {
    return `${days} days ago, ${formattedHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  }
};

// ==================== GET USER BY ID (ADMIN & USER SELF) ====================

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;

    // Check authorization - only admin or the user themselves can view
    if (requestingUserRole !== "admin" && requestingUserId !== id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this user's details",
      });
    }

    const usersCollection = db.collection("users");
    const depositsCollection = db.collection("deposits");
    const withdrawalsCollection = db.collection("withdrawals");
    const goalsCollection = db.collection("goals");
    const circlesCollection = db.collection("circles");
    const loginHistoryCollection = db.collection("login_history");
    const sessionsCollection = db.collection("user_sessions");

    // Get user basic info
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

    // Get all deposits
    const deposits = await depositsCollection
      .find({ userId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Get all withdrawals
    const withdrawals = await withdrawalsCollection
      .find({ userId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Get all goals
    const goals = await goalsCollection
      .find({ userId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .toArray();

    // Get circles user is part of
    const circles = await circlesCollection
      .find({ 
        $or: [
          { creatorId: new ObjectId(id) },
          { "members.userId": new ObjectId(id) }
        ]
      })
      .toArray();

    // Get login history (last 20)
    const loginHistory = await loginHistoryCollection
      .find({ userId: new ObjectId(id) })
      .sort({ loginTime: -1 })
      .limit(20)
      .toArray();

    // Get active sessions
    const activeSessions = await sessionsCollection
      .find({ 
        userId: new ObjectId(id), 
        isActive: true,
        expiresAt: { $gt: new Date() }
      })
      .sort({ lastActivity: -1 })
      .toArray();

    // Calculate statistics
    const totalDeposits = deposits
      .filter(d => d.status === "approved")
      .reduce((sum, d) => sum + (d.depositAmount || d.amount || 0), 0);
    
    const totalWithdrawals = withdrawals
      .filter(w => w.status === "completed")
      .reduce((sum, w) => sum + (w.withdrawalAmount || w.amount || 0), 0);
    
    const pendingDeposits = deposits.filter(d => d.status === "pending").length;
    const pendingWithdrawals = withdrawals.filter(w => w.status === "pending").length;
    
    const activeGoals = goals.filter(g => g.status === "active").length;
    const completedGoals = goals.filter(g => g.status === "completed").length;
    
    const totalLoginSuccess = loginHistory.filter(l => l.success === true).length;
    const totalLoginFailed = loginHistory.filter(l => l.success === false).length;

    // Format deposits for response
    const formattedDeposits = deposits.map(d => ({
      id: d._id,
      amount: d.depositAmount || d.amount || 0,
      status: d.status,
      method: d.paymentMethod || d.method,
      transactionId: d.transactionId,
      screenshot: d.screenshot,
      note: d.note,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    // Format withdrawals for response
    const formattedWithdrawals = withdrawals.map(w => ({
      id: w._id,
      amount: w.withdrawalAmount || w.amount || 0,
      status: w.status,
      method: w.paymentMethod || w.method,
      transactionId: w.transactionId,
      note: w.note,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    // Format goals for response
    const formattedGoals = goals.map(g => ({
      id: g._id,
      title: g.title,
      type: g.type,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      monthlyDeposit: g.monthlyDeposit,
      duration: g.duration,
      startDate: g.startDate,
      targetDate: g.targetDate,
      status: g.status,
      progress: g.currentAmount && g.targetAmount 
        ? Math.round((g.currentAmount / g.targetAmount) * 100) 
        : 0,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));

    // Format login history for response
    const formattedLoginHistory = loginHistory.map(h => ({
      id: h._id,
      success: h.success,
      device: h.device,
      deviceName: h.deviceName,
      browser: h.browser,
      os: h.os,
      ip: h.ip,
      location: h.location,
      failureReason: h.failureReason,
      loginTime: h.loginTime,
    }));

    // Format active sessions for response
    const formattedSessions = activeSessions.map(s => ({
      id: s._id,
      device: s.device,
      deviceName: s.deviceName,
      browser: s.browser,
      os: s.os,
      ip: s.ip,
      location: s.location,
      lastActivity: s.lastActivity,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));

    // Format circles for response
    const formattedCircles = circles.map(c => ({
      id: c._id,
      name: c.name,
      type: c.type,
      status: c.status,
      totalMembers: c.members?.length || 0,
      totalSaved: c.totalSaved || 0,
      createdAt: c.createdAt,
    }));

    // Prepare response data
    const responseData = {
      // Basic Information
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      
      // Personal Details
      dob: user.dob,
      gender: user.gender,
      division: user.division,
      district: user.district,
      upazila: user.upazila,
      village: user.village,
      postOffice: user.postOffice,
      postCode: user.postCode,
      occupation: user.occupation,
      income: user.income,
      
      // Address
      address: user.address,
      
      // Account Status
      accountActive: user.accountActive,
      isBanned: user.isBanned,
      isSuspended: user.isSuspended,
      banReason: user.banReason,
      suspensionReason: user.suspensionReason,
      
      // KYC Information
      kycStatus: user.kyc?.status || "pending",
      kycCompleted: user.kycCompleted || false,
      kyc: user.kyc,
      
      // Plan & Level
      selectedPlan: user.selectedPlan,
      level: user.level,
      streak: user.streak,
      
      // Financial Statistics
      totalSaved: user.totalSaved || 0,
      totalDeposits: totalDeposits,
      totalWithdrawals: totalWithdrawals,
      netSavings: totalDeposits - totalWithdrawals,
      pendingDeposits: pendingDeposits,
      pendingWithdrawals: pendingWithdrawals,
      
      // Goal Statistics
      totalGoals: goals.length,
      activeGoals: activeGoals,
      completedGoals: completedGoals,
      
      // Referral Information
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      referralBonusApplied: user.referralBonusApplied,
      
      // Nominee Information
      nominee: user.nominee,
      
      // Payment Information
      paymentMethod: user.paymentMethod,
      paymentDetails: user.paymentDetails,
      
      // Profile
      profilePicture: user.profilePicture,
      
      // Login Statistics
      loginStats: {
        totalLogins: totalLoginSuccess,
        failedLogins: totalLoginFailed,
        lastLogin: user.lastLogin,
        lastLoginIp: user.lastLoginIp,
        lastLoginDevice: user.lastLoginDevice,
      },
      
      // Verification Flags
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      
      // Marketing & Agreements
      marketing: user.marketing,
      termsAccepted: user.termsAccepted,
      withdrawalPolicyAccepted: user.withdrawalPolicyAccepted,
      
      // Timestamps
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      
      // Detailed Lists
      deposits: formattedDeposits,
      withdrawals: formattedWithdrawals,
      goals: formattedGoals,
      circles: formattedCircles,
      loginHistory: formattedLoginHistory,
      activeSessions: formattedSessions,
      
      // Summary
      summary: {
        totalDepositAmount: totalDeposits,
        totalWithdrawalAmount: totalWithdrawals,
        netSavings: totalDeposits - totalWithdrawals,
        totalGoals: goals.length,
        completedGoals: completedGoals,
        totalCircles: circles.length,
        totalLoginAttempts: totalLoginSuccess + totalLoginFailed,
        successRate: totalLoginSuccess + totalLoginFailed > 0 
          ? Math.round((totalLoginSuccess / (totalLoginSuccess + totalLoginFailed)) * 100) 
          : 0,
      },
    };

    // Add goal specific data if exists
    if (user.goal) {
      responseData.goal = {
        type: user.goal.type,
        targetAmount: user.goal.targetAmount,
        monthlyDeposit: user.goal.monthlyDeposit,
        duration: user.goal.duration,
        currentSaved: user.goal.currentSaved,
        progress: user.goal.progress,
      };
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user details",
    });
  }
};

// Add this to auth.controller.js

// ==================== SEARCH USER BY PHONE ====================

export const searchUserByPhone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone } = req.query;

    if (!phone || phone.length < 11) {
      return res.status(400).json({
        success: false,
        message: "Valid phone number is required",
      });
    }

    // Clean phone number (remove +880 if present)
    let cleanPhone = phone.replace(/^\+880/, '').replace(/\D/g, '');
    
    // If phone starts with 0, remove it
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }

    // Ensure phone is exactly 11 digits (for Bangladesh)
    if (cleanPhone.length !== 11) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be 11 digits (e.g., 1XXXXXXXXXX)",
      });
    }

    const usersCollection = db.collection("users");

    // Find user by phone - search with and without +880
    const user = await usersCollection.findOne(
      { 
        $or: [
          { phone: phone },
          { phone: `+880${cleanPhone}` },
          { phone: `0${cleanPhone}` },
          { phone: cleanPhone }
        ]
      },
      { 
        projection: { 
          password: 0, 
          pin: 0,
          refreshToken: 0,
          goals: 0,
        } 
      }
    );

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

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.fullName || user.firstName,
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