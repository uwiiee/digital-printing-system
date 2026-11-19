import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.resolve(__dirname, "../../uploads"); // backend/uploads
fs.mkdirSync(uploadsDir, { recursive: true });

// The extension comes from the verified mimetype, never from the user's filename
const EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export const designUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) =>
      cb(null, crypto.randomUUID() + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    EXT[file.mimetype]
      ? cb(null, true)
      : cb(new Error("Only PNG, JPG, or WEBP images are allowed")),
});
