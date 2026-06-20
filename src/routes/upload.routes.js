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
router.post(
    "/kyc/:folder", 
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