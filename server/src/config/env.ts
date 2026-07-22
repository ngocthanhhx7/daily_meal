import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().optional()
);

const boolFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/daily_meal"),
  JWT_SECRET: z.string().min(16).default("daily-meal-local-development-secret"),
  ADMIN_EMAIL: optionalString,
  ADMIN_PASSWORD: optionalString,
  CLIENT_ORIGIN: z.string().default("*"),
  UPLOAD_DIR: z.string().default("uploads"),
  VIDEO_MAX_BYTES: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(50 * 1024 * 1024)
  ),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  AWS_REGION: z.preprocess((value) => (value === "" ? undefined : value), z.string().default("us-east-1")),
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_SESSION_TOKEN: optionalString,
  AWS_S3_BUCKET: optionalString,
  S3_BUCKET: optionalString,
  S3_PUBLIC_BASE_URL: optionalString,
  S3_ENDPOINT: optionalString,
  S3_FORCE_PATH_STYLE: boolFromEnv.default(false),
  S3_OBJECT_ACL: optionalString,
  AI_MAX_TOKENS: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(1200)
  ),
  GEMINI_API_KEY: optionalString,
  GEMINI_BASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai")
  ),
  GEMINI_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().default("gemini-3.1-flash-lite")
  ),
  GEOAPIFY_API_KEY: optionalString,
  WEATHER_USER_AGENT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().default("DailyMeal/1.0 https://dailymeal.site")
  ),
  GOOGLE_WEB_CLIENT_ID: optionalString,
  GOOGLE_ANDROID_CLIENT_ID: optionalString,
  GOOGLE_IOS_CLIENT_ID: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().int().positive().default(587)),
  SMTP_SECURE: boolFromEnv.default(false),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  MAIL_FROM_NAME: z.string().default("Daily Meal"),
  MAIL_FROM_EMAIL: optionalString,
  PAYOS_CLIENT_ID: optionalString,
  PAYOS_API_KEY: optionalString,
  PAYOS_CHECKSUM_KEY: optionalString,
  PAYOS_RETURN_URL: optionalString,
  PAYOS_CANCEL_URL: optionalString,
  PAYOS_API_BASE_URL: z.string().url().default("https://api-merchant.payos.vn")
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  S3_BUCKET: parsed.S3_BUCKET ?? parsed.AWS_S3_BUCKET,
  UPLOAD_DIR: path.resolve(process.cwd(), parsed.UPLOAD_DIR)
};
