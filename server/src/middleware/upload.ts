import multer from "multer";
import path from "node:path";
import { HttpError } from "./error.js";

const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedImageMimeTypes.has(file.mimetype) || (ext && !allowedImageExtensions.has(ext))) {
      cb(new HttpError(400, "Only PNG, JPEG, WebP, and GIF uploads are supported"));
      return;
    }
    cb(null, true);
  }
});
