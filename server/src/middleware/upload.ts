import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { env } from "../config/env.js";
import { HttpError } from "./error.js";

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeName = `${Date.now()}-${randomUUID()}${ext}`;
    cb(null, safeName);
  }
});

export const uploadImage = multer({
  storage,
  limits: {
    files: 1,
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new HttpError(400, "Only image uploads are supported"));
      return;
    }
    cb(null, true);
  }
});
