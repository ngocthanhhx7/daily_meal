import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { assertImageUploadSize, uploadMedia } from "../middleware/upload.js";
import { HttpError } from "../middleware/error.js";
import { Upload } from "../models/Upload.js";
import { storeUploadedFile } from "../services/storage.js";

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  requireAuth,
  uploadMedia.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  async (req, res, next) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const image = files?.image?.[0];
    const video = files?.video?.[0];

    if (image && video) {
      throw new HttpError(400, "Upload either an image or a video, not both");
    }

    const file = image ?? video;

    if (!file) {
      throw new HttpError(400, "Image or video file is required");
    }

    const mediaType = video ? "video" : "image";

    if (mediaType === "video" && !req.user?.isPremium) {
      throw new HttpError(403, "Premium is required to upload videos");
    }

    if (mediaType === "image") {
      assertImageUploadSize(file);
    }

    const category = typeof req.query.category === "string" ? req.query.category : "other";
    const stored = await storeUploadedFile(file, category);
    const upload = await Upload.create({
      owner: req.user?.id,
      category,
      mediaType,
      ...stored,
      originalName: file.originalname,
      mime: file.mimetype,
      size: file.size
    });

    res.status(201).json({ upload });
  } catch (error) {
    next(error);
  }
  }
);
