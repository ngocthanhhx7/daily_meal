import multer from "multer";
import { HttpError } from "./error.js";

export const uploadImage = multer({
  storage: multer.memoryStorage(),
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
