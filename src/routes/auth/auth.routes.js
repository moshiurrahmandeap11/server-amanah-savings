import { Router } from "express";
import { 
  register,
  sendEmailOtp,
  verifyEmailOtp,
  login,
  getCurrentUser,
  updateProfile,
  changePassword,
  changePin,
  updateNominee,
  updatePaymentMethod,
  uploadProfilePicture,
  deleteProfilePicture,
  deleteAccount,
  getUserById,
  searchUserByPhone,
} from "../../controllers/auth/auth.controller.js";
import verifyToken from "../../middlewares/verifyToken.js";
import { uploadSingle } from "../../middlewares/upload.js";

const router = Router();

// ==================== PUBLIC ROUTES ====================

// Registration
router.post("/register", register);

// OTP Routes
router.post("/send-email-otp", sendEmailOtp);
router.post("/verify-email-otp", verifyEmailOtp);

// Login
router.post("/login", login);

// ==================== PROTECTED ROUTES ====================

// User Profile
router.get("/me", verifyToken, getCurrentUser);
router.get("/users/:id", verifyToken, getUserById);
router.put("/profile", verifyToken, updateProfile);
router.put("/change-password", verifyToken, changePassword);
router.put("/change-pin", verifyToken, changePin);

// Profile Picture
router.post(
  "/profile-picture",
  verifyToken,
  uploadSingle("profile_pictures", "profilePicture"),
  uploadProfilePicture
);
router.delete("/profile-picture", verifyToken, deleteProfilePicture);

// Nominee
router.put("/nominee", verifyToken, updateNominee);

// Payment Method
router.put("/payment-method", verifyToken, updatePaymentMethod);

// Account
router.delete("/account", verifyToken, deleteAccount);

router.get("/search", verifyToken, searchUserByPhone); 

export default router;