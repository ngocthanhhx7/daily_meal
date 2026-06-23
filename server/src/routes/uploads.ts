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
      throw new HttpError(400, "Chỉ tải lên hình ảnh hoặc video, không tải lên cả hai");
    }

    const file = image ?? video;

    if (!file) {
      throw new HttpError(400, "Yêu cầu tệp hình ảnh hoặc video");
    }

    const mediaType = video ? "video" : "image";

    if (mediaType === "video" && !req.user?.isPremium) {
      throw new HttpError(403, "Yêu cầu tài khoản Premium để tải lên video");
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
