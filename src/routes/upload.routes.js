// routes/upload.routes.js
import { Router } from "express";
import { 
    uploadSingleFile, 
    uploadMultipleFiles, 
    deleteFile,
    uploadKycFiles
} from "../controllers/upload.controller.js";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.js";
import verifyToken from "../middlewares/verifyToken.js";

const router = Router();

// ==================== PUBLIC KYC UPLOAD (NO TOKEN REQUIRED) ====================
// KYC uploads during registration - no token needed
// Simple IP-based rate limiting to prevent abuse
const kycUploadAttempts = new Map();
const MAX_KYC_UPLOADS_PER_IP = 20; // 20 uploads per IP per 10 minutes
const KYC_UPLOAD_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const kycUploadRateLimit = (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Clean up old entries
    for (const [ip, data] of kycUploadAttempts.entries()) {
        if (now - data.firstAttempt > KYC_UPLOAD_WINDOW_MS) {
            kycUploadAttempts.delete(ip);
        }
    }
    
    const attempts = kycUploadAttempts.get(clientIp);
    if (attempts) {
        if (now - attempts.firstAttempt > KYC_UPLOAD_WINDOW_MS) {
            // Reset window
            kycUploadAttempts.set(clientIp, { count: 1, firstAttempt: now });
        } else if (attempts.count >= MAX_KYC_UPLOADS_PER_IP) {
            console.log(`[Rate Limit] KYC upload blocked for IP: ${clientIp}`);
            return res.status(429).json({
                success: false,
                message: "Too many upload attempts. Please try again later."
            });
        } else {
            attempts.count++;
        }
    } else {
        kycUploadAttempts.set(clientIp, { count: 1, firstAttempt: now });
    }
    
    next();
};

router.post(
    "/kyc/:folder", 
    kycUploadRateLimit,
    (req, res, next) => {
        const folder = req.params.folder;
        // Validate folder name to prevent abuse
        const allowedFolders = ['kyc_nid_front', 'kyc_nid_back', 'kyc_birth_certificate', 'kyc_selfie', 'kyc_passport', 'profile_pictures'];
        if (!allowedFolders.includes(folder)) {
            return res.status(400).json({
                success: false,
                message: "Invalid upload folder"
            });
        }
        const upload = uploadMultiple(folder, 'files', 10);
        upload(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
            next();
        });
    }, 
    uploadKycFiles
);

// ==================== PROTECTED ROUTES (TOKEN REQUIRED) ====================
// All other uploads require authentication
router.use(verifyToken);

// Single file upload (authenticated)
router.post(
    "/single/:folder", 
    (req, res, next) => {
        const folder = req.params.folder;
        const upload = uploadSingle(folder, 'file');
        upload(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
            next();
        });
    }, 
    uploadSingleFile
);

// Multiple files upload (authenticated)
router.post(
    "/multiple/:folder", 
    (req, res, next) => {
        const folder = req.params.folder;
        const upload = uploadMultiple(folder, 'files', 10);
        upload(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
            next();
        });
    }, 
    uploadMultipleFiles
);

// Delete file (authenticated)
router.delete("/delete", verifyToken, deleteFile);

export default router;