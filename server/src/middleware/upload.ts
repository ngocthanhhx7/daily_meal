import multer from "multer";
import path from "node:path";
import { env } from "../config/env.js";
import { HttpError } from "./error.js";

const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const allowedVideoMimeTypes = new Set(["video/mp4", "video/quicktime", "video/x-m4v"]);
const allowedVideoExtensions = new Set([".mp4", ".mov", ".m4v"]);
const maxImageBytes = 8 * 1024 * 1024;

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: maxImageBytes
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

export const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: env.VIDEO_MAX_BYTES
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = allowedImageMimeTypes.has(file.mimetype) && (!ext || allowedImageExtensions.has(ext));
    const isVideo = allowedVideoMimeTypes.has(file.mimetype) && (!ext || allowedVideoExtensions.has(ext));

    if (!isImage && !isVideo) {
      cb(new HttpError(400, "Only image and MP4, MOV, or M4V video uploads are supported"));
      return;
    }
    cb(null, true);
  }
});

export function assertImageUploadSize(file: Express.Multer.File) {
  if (file.size > maxImageBytes) {
    throw new HttpError(400, "Image uploads must be 8MB or smaller");
  }
}

export const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: env.VIDEO_MAX_BYTES
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedVideoMimeTypes.has(file.mimetype) || (ext && !allowedVideoExtensions.has(ext))) {
      cb(new HttpError(400, "Only MP4, MOV, and M4V video uploads are supported"));
      return;
    }
    cb(null, true);
  }
});
