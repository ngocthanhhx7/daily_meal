import { Router } from "express";
import { Sticker } from "../models/Sticker.js";
import { requireAuth } from "../middleware/auth.js";

export const stickersRouter = Router();

stickersRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const stickers = await Sticker.find().sort({ premiumOnly: 1, name: 1 }).lean();
    res.json({ stickers });
  } catch (error) {
    next(error);
  }
});
