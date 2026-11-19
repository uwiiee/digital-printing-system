import { Router } from "express";
import rateLimit from "express-rate-limit";
import { optionalAuthenticate } from "../middleware/auth.js";
import { designUpload } from "../config/uploads.js";

const router = Router();

// Guests can attach a design too, so uploads without a login are limited per address
const guestUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.GUEST_UPLOAD_LIMIT) || 60,
  skip: (req) => Boolean(req.user),
  message: { message: "Too many uploads from this connection. Please try again later." },
});

router.post("/design", optionalAuthenticate, guestUploadLimiter, (req, res) => {
  if (req.user && req.user.role !== "customer") return res.status(403).json({ message: "Forbidden" });

  designUpload.single("design")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });
    res.status(201).json({ path: `/uploads/${req.file.filename}` });
  });
});

export default router;
