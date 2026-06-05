import { Router } from "express";
import { Sticker } from "../models/Sticker.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const stickersRouter = Router();

stickersRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const stickers = await Sticker.find().sort({ premiumOnly: 1, name: 1 }).lean();
    res.json({ stickers });
  } catch (error) {
    next(error);
  }
});

stickersRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user?.isPremium) {
      throw new HttpError(403, "Chỉ tài khoản VIP mới được tự tải nhãn dán.");
    }
    const { name, assetPath, key } = req.body;
    if (!name || !assetPath || !key) {
      throw new HttpError(400, "Thiếu thông tin nhãn dán.");
    }
    const sticker = await Sticker.create({
      key,
      name,
      assetPath,
      premiumOnly: true
    });
    res.status(201).json({ sticker });
  } catch (error) {
    next(error);
  }
});
