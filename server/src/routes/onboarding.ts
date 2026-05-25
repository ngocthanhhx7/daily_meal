import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { User } from "../models/User.js";

export const onboardingRouter = Router();

const preferencesSchema = z.object({
  interests: z.array(z.string()).max(10).default([]),
  eatingStyles: z.array(z.string()).max(10).default([])
});

onboardingRouter.patch("/preferences", requireAuth, async (req, res, next) => {
  try {
    const body = preferencesSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      {
        $set: {
          preferences: {
            interests: body.interests,
            eatingStyles: body.eatingStyles,
            completedOnboarding: true
          }
        }
      },
      { new: true }
    );

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    res.json({
      preferences: user.preferences
    });
  } catch (error) {
    next(error);
  }
});
