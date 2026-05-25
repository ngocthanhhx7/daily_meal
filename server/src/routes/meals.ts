import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { Meal } from "../models/Meal.js";
import { Upload } from "../models/Upload.js";
import { analyzeFoodImage } from "../services/gemini.js";
import { readStoredUpload } from "../services/storage.js";

export const mealsRouter = Router();

const analyzeSchema = z.object({
  uploadId: z.string().min(1)
});

mealsRouter.post("/analyze", requireAuth, async (req, res, next) => {
  try {
    const body = analyzeSchema.parse(req.body);
    const upload = await Upload.findOne({ _id: body.uploadId, owner: req.user?.id }).lean();

    if (!upload) {
      throw new HttpError(404, "Uploaded image not found");
    }

    const imageData = await readStoredUpload(upload);
    const result = await analyzeFoodImage({
      imageData,
      imagePath: upload.localPath ?? undefined,
      mimeType: upload.mime
    });

    const meal = await Meal.create({
      user: req.user?.id,
      image: {
        url: upload.url,
        localPath: upload.localPath,
        uploadId: upload._id
      },
      result
    });

    res.status(201).json({ meal });
  } catch (error) {
    next(error);
  }
});

mealsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const meals = await Meal.find({ user: req.user?.id }).sort({ createdAt: -1 }).lean();
    res.json({ meals });
  } catch (error) {
    next(error);
  }
});

mealsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const meal = await Meal.findOne({ _id: req.params.id, user: req.user?.id }).lean();

    if (!meal) {
      throw new HttpError(404, "Meal not found");
    }

    res.json({ meal });
  } catch (error) {
    next(error);
  }
});
