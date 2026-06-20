// import { deleteFromCloudinary } from "../middlewares/upload.js";


// export const uploadSingleFile = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "No file uploaded",
//       });
//     }

//     let resourceType = "raw";
//     if (req.file.mimetype.startsWith("image/")) {
//       resourceType = "image";
//     } else if (req.file.mimetype.startsWith("video/")) {
//       resourceType = "video";
//     }

//     const fileData = {
//       url: req.file.path,
//       publicId: req.file.filename,
//       format: req.file.mimetype.split("/")[1],
//       size: req.file.size,
//       originalName: req.file.originalname,
//       resourceType: resourceType,
//     };

//     return res.status(200).json({
//       success: true,
//       message: "File uploaded successfully",
//       data: fileData,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message || "File upload failed",
//     });
//   }
// };

// export const uploadMultipleFiles = async (req, res) => {
//   try {
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No files uploaded",
//       });
//     }

//     const filesData = req.files.map((file) => {
//       let resourceType = "raw";
//       if (file.mimetype.startsWith("image/")) {
//         resourceType = "image";
//       } else if (file.mimetype.startsWith("video/")) {
//         resourceType = "video";
//       }

//       return {
//         url: file.path,
//         publicId: file.filename,
//         format: file.mimetype.split("/")[1],
//         size: file.size,
//         originalName: file.originalname,
//         resourceType: resourceType,
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       message: `${filesData.length} files uploaded successfully`,
//       data: filesData,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message || "File upload failed",
//     });
//   }
// };

// export const deleteFile = async (req, res) => {
//   try {
//     const { publicId, resourceType } = req.body;

//     if (!publicId) {
//       return res.status(400).json({
//         success: false,
//         message: "Public ID is required",
//       });
//     }

//     const result = await deleteFromCloudinary(
//       publicId,
//       resourceType || "image",
//     );

//     if (result.result === "ok") {
//       return res.status(200).json({
//         success: true,
//         message: "File deleted successfully",
//       });
//     } else {
//       return res.status(404).json({
//         success: false,
//         message: "File not found",
//       });
//     }
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message || "File deletion failed",
//     });
//   }
// };

import { deleteFromCloudinary } from "../middlewares/upload.js";

export const uploadSingleFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    let resourceType = "raw";
    if (req.file.mimetype.startsWith("image/")) {
      resourceType = "image";
    } else if (req.file.mimetype.startsWith("video/")) {
      resourceType = "video";
    }

    const fileData = {
      url: req.file.path,
      publicId: req.file.filename,
      format: req.file.mimetype.split("/")[1],
      size: req.file.size,
      originalName: req.file.originalname,
      resourceType: resourceType,
    };

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: fileData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "File upload failed",
    });
  }
};

export const uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const filesData = req.files.map((file) => {
      let resourceType = "raw";
      if (file.mimetype.startsWith("image/")) {
        resourceType = "image";
      } else if (file.mimetype.startsWith("video/")) {
        resourceType = "video";
      }

      return {
        url: file.path,
        publicId: file.filename,
        format: file.mimetype.split("/")[1],
        size: file.size,
        originalName: file.originalname,
        resourceType: resourceType,
      };
    });

    return res.status(200).json({
      success: true,
      message: `${filesData.length} files uploaded successfully`,
      data: filesData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "File upload failed",
    });
  }
};

// NEW: Upload KYC files separately
export const uploadKycFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const filesData = req.files.map((file) => {
      let resourceType = "raw";
      if (file.mimetype.startsWith("image/")) {
        resourceType = "image";
      } else if (file.mimetype.startsWith("video/")) {
        resourceType = "video";
      }

      return {
        url: file.path,
        publicId: file.filename,
        format: file.mimetype.split("/")[1],
        size: file.size,
        originalName: file.originalname,
        resourceType: resourceType,
      };
    });

    return res.status(200).json({
      success: true,
      message: `${filesData.length} KYC files uploaded successfully`,
      data: filesData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "KYC file upload failed",
    });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { publicId, resourceType } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    const result = await deleteFromCloudinary(
      publicId,
      resourceType || "image",
    );

    if (result.result === "ok") {
      return res.status(200).json({
        success: true,
        message: "File deleted successfully",
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "File deletion failed",
    });
  }
};