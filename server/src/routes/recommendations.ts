import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { RecommendationFeedback } from "../models/RecommendationFeedback.js";
import { User } from "../models/User.js";
import { buildMealRecommendations } from "../services/recommendations/engine.js";
import {
  mealRecommendationProfilePatchSchema,
  mealRecommendationProfileSchema,
  normalizeMealRecommendationProfile
} from "../services/recommendations/profile.js";

export const recommendationsRouter = Router();

const recommendationLimiter = rateLimiter({
  windowMs: 60_000,
  max: 20,
  message: "Bạn đang làm mới gợi ý quá nhanh. Vui lòng thử lại sau một phút.",
  keyGenerator: (req) => req.user?.id ? `recommendations:${req.user.id}` : undefined
});

const feedbackLimiter = rateLimiter({
  windowMs: 60_000,
  max: 60,
  message: "Bạn đang gửi phản hồi quá nhanh. Vui lòng thử lại sau một phút.",
  keyGenerator: (req) => req.user?.id ? `recommendation-feedback:${req.user.id}` : undefined
});

const todaySchema = z
  .object({
    mode: z.enum(["cook", "eat_out", "any"]).default("any"),
    mealPeriod: z.enum(["breakfast", "lunch", "dinner", "late_night"]).default("lunch"),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    limit: z.number().int().min(1).max(10).default(5)
  })
  .superRefine((value, context) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần gửi đồng thời latitude và longitude"
      });
    }
  });

const feedbackSchema = z.object({
  targetKey: z.string().trim().min(1).max(200),
  targetType: z.enum(["meal", "restaurant"]),
  action: z.enum(["liked", "dismissed", "opened_recipe", "opened_restaurant"])
});

recommendationsRouter.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select("mealRecommendationProfile").lean();
    if (!user) {
      throw new HttpError(404, "Không tìm thấy người dùng");
    }
    res.json({ profile: normalizeMealRecommendationProfile(user.mealRecommendationProfile) });
  } catch (error) {
    next(error);
  }
});

recommendationsRouter.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const patch = mealRecommendationProfilePatchSchema.parse(req.body);
    const currentUser = await User.findById(req.user?.id).select("mealRecommendationProfile").lean();
    if (!currentUser) {
      throw new HttpError(404, "Không tìm thấy người dùng");
    }
    const profile = mealRecommendationProfileSchema.parse({
      ...normalizeMealRecommendationProfile(currentUser.mealRecommendationProfile),
      ...patch
    });
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { $set: { mealRecommendationProfile: profile } },
      { new: true }
    )
      .select("mealRecommendationProfile")
      .lean();

    if (!user) {
      throw new HttpError(404, "Không tìm thấy người dùng");
    }
    res.json({ profile: normalizeMealRecommendationProfile(user.mealRecommendationProfile) });
  } catch (error) {
    next(error);
  }
});

recommendationsRouter.post("/today", requireAuth, recommendationLimiter, async (req, res, next) => {
  try {
    const body = todaySchema.parse(req.body);
    const result = await buildMealRecommendations({
      userId: req.user!.id,
      mode: body.mode,
      mealPeriod: body.mealPeriod,
      latitude: body.latitude,
      longitude: body.longitude,
      limit: body.limit
    });
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      next(new HttpError(404, "Không tìm thấy người dùng"));
      return;
    }
    next(error);
  }
});

recommendationsRouter.post("/feedback", requireAuth, feedbackLimiter, async (req, res, next) => {
  try {
    const body = feedbackSchema.parse(req.body);
    const feedback = await RecommendationFeedback.findOneAndUpdate(
      { user: req.user!.id, targetKey: body.targetKey, targetType: body.targetType, action: body.action },
      { $set: { ...body }, $setOnInsert: { user: req.user!.id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({
      feedback: {
        id: feedback._id.toString(),
        targetKey: feedback.targetKey,
        targetType: feedback.targetType,
        action: feedback.action
      }
    });
  } catch (error) {
    next(error);
  }
});
