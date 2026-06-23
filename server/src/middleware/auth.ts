import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { hasActivePremium } from "../utils/premium.js";
import { HttpError } from "./error.js";

type JwtPayload = {
  sub: string;
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      throw new HttpError(401, "Yêu cầu xác thực tài khoản");
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(payload.sub)
      .select("email phone isPremium premiumTrialEndsAt premiumPaidEndsAt")
      .lean();

    if (!user) {
      throw new HttpError(401, "Phiên làm việc không hợp lệ");
    }

    req.user = {
      id: user._id.toString(),
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      isPremium: hasActivePremium(user)
    };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Phiên làm việc không hợp lệ"));
  }
};

