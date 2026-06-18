import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/ico",
  ];
  const allowedVideoTypes = [
    "video/mp4",
    "video/mkv",
    "video/avi",
    "video/mov",
    "video/webm",
  ];
  const allowedDocumentTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const allAllowed = [
    ...allowedImageTypes,
    ...allowedVideoTypes,
    ...allowedDocumentTypes,
  ];

  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only images, videos, and PDFs are allowed!",
      ),
      false,
    );
  }
};

const createStorage = (folderName) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      let resourceType = "auto";

      let format = undefined;

      if (file.mimetype.startsWith("image/")) {
        resourceType = "image";
        format = file.mimetype.split("/")[1];
      } else if (file.mimetype.startsWith("video/")) {
        resourceType = "video";
        format = file.mimetype.split("/")[1];
      } else if (
        file.mimetype === "application/pdf" ||
        file.mimetype === "application/msword" ||
        file.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        resourceType = "raw";
      }

      return {
        folder: folderName,
        resource_type: resourceType,

        ...(format && { format: format }),
        public_id: `${Date.now()}_${Math.round(Math.random() * 1e9)}`,
        transformation:
          resourceType === "image"
            ? [
                { width: 1200, height: 1200, crop: "limit" },
                { quality: "auto" },
              ]
            : [],
      };
    },
  });
};

export const uploadSingle = (folderName, fieldName) => {
  const storage = createStorage(folderName);
  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
  });
  return upload.single(fieldName);
};

export const uploadMultiple = (folderName, fieldName, maxCount = 10) => {
  const storage = createStorage(folderName);
  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
  });
  return upload.array(fieldName, maxCount);
};

export const uploadFields = (folderName, fields) => {
  const storage = createStorage(folderName);
  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
  });
  return upload.fields(fields);
};

export const deleteFromCloudinary = async (
  publicId,
  resourceType = "image",
) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw error;
  }
};

export const getPublicIdFromUrl = (url) => {
  const parts = url.split("/");
  const filename = parts.pop();
  const publicId = filename.split(".")[0];
  return publicId;
};