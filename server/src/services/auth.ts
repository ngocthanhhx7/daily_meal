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
