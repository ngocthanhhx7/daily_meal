import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { uploadImage } from "../middleware/upload.js";
import { HttpError } from "../middleware/error.js";
import { Upload } from "../models/Upload.js";
import { storeUploadedImage } from "../services/storage.js";

export const uploadsRouter = Router();

uploadsRouter.post("/", requireAuth, uploadImage.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, "Image file is required");
    }

    const category = typeof req.query.category === "string" ? req.query.category : "other";
    const stored = await storeUploadedImage(req.file, category);
    const upload = await Upload.create({
      owner: req.user?.id,
      category,
      ...stored,
      originalName: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size
    });

    res.status(201).json({ upload });
  } catch (error) {
    next(error);
  }
});
