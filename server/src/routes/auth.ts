import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { User } from "../models/User.js";
import { hashPassword, signAccessToken, verifyPassword } from "../services/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const authRouter = Router();

const authBodySchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6),
  displayName: z.string().min(1).max(80).optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(128)
});

const facebookAuthSchema = z.object({
  accessToken: z.string().min(1)
});

function userDto(user: any) {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    birthday: user.birthday
      ? {
          date: user.birthday.date
            ? new Date(user.birthday.date).toISOString().slice(0, 10)
            : "",
          visibility: user.birthday.visibility ?? "hidden"
        }
      : { date: "", visibility: "hidden" },
    preferences: user.preferences,
    isPremium: user.isPremium,
    counts: user.counts
  };
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = authBodySchema.parse(req.body);
    const existing = await User.findOne({ email: body.email }).lean();

    if (existing) {
      throw new HttpError(409, "Email is already registered");
    }

    const user = await User.create({
      email: body.email,
      passwordHash: await hashPassword(body.password),
      displayName: body.displayName ?? body.email.split("@")[0]
    });

    res.status(201).json({
      token: signAccessToken(user._id.toString()),
      user: userDto(user)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = authBodySchema.pick({ email: true, password: true }).parse(req.body);
    const user = await User.findOne({ email: body.email });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }

    res.json({
      token: signAccessToken(user._id.toString()),
      user: userDto(user)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/facebook", async (req, res, next) => {
  try {
    const { accessToken } = facebookAuthSchema.parse(req.body);

    // Call Facebook Graph API to verify the token and get user profile
    const fbResponse = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
    );

    if (!fbResponse.ok) {
      const errorData = await fbResponse.json().catch(() => ({}));
      throw new HttpError(400, (errorData as any)?.error?.message || "Failed to authenticate with Facebook");
    }

    const fbUser = (await fbResponse.json()) as {
      id: string;
      name: string;
      email?: string;
      picture?: {
        data?: {
          url?: string;
        };
      };
    };

    let user = await User.findOne({ facebookId: fbUser.id });

    if (!user) {
      // If user not found by facebookId, check by email (if email exists)
      if (fbUser.email) {
        user = await User.findOne({ email: fbUser.email.toLowerCase() });
        if (user) {
          // Link account if email matches
          user.facebookId = fbUser.id;
          if (!user.avatarUrl && fbUser.picture?.data?.url) {
            user.avatarUrl = fbUser.picture.data.url;
          }
          await user.save();
        }
      }
    }

    if (!user) {
      // Create new user if not found at all
      const email = fbUser.email ? fbUser.email.toLowerCase() : `fb_${fbUser.id}@facebook.dailymeal.com`;
      
      // Generate a secure random password hash since passwordHash is required
      const randomPassword = crypto.randomUUID();
      const passwordHash = await hashPassword(randomPassword);

      user = await User.create({
        email,
        passwordHash,
        facebookId: fbUser.id,
        displayName: fbUser.name || `fb_${fbUser.id}`,
        avatarUrl: fbUser.picture?.data?.url || ""
      });
    }

    res.json({
      token: signAccessToken(user._id.toString()),
      user: userDto(user)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    res.json({ user: userDto(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/password", requireAuth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const user = await User.findById(req.user?.id);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw new HttpError(401, "Current password is incorrect");
    }

    user.passwordHash = await hashPassword(body.newPassword);
    await user.save();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
