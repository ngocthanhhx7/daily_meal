import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/daily_meal"),
  JWT_SECRET: z.string().min(16).default("daily-meal-local-development-secret"),
  CLIENT_ORIGIN: z.string().default("*"),
  UPLOAD_DIR: z.string().default("uploads"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash-lite"),
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-2.5-flash-lite")
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  UPLOAD_DIR: path.resolve(process.cwd(), parsed.UPLOAD_DIR)
};
