import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "30d" });
}

export function normalizePhoneNumber(phone: string) {
  const compact = phone.replace(/[\s().-]/g, "");
  if (compact.startsWith("+")) {
    return compact;
  }
  if (compact.startsWith("0")) {
    return `+84${compact.slice(1)}`;
  }
  if (compact.startsWith("84")) {
    return `+${compact}`;
  }
  return compact;
}
