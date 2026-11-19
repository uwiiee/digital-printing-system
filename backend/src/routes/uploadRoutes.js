import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { designUpload } from "../config/uploads.js";

const router = Router();

router.post("/design", authenticate, authorize("customer"), (req, res) => {
  designUpload.single("design")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file)
      return res.status(400).json({ message: "No image uploaded" });
    res.status(201).json({ path: `/uploads/${req.file.filename}` });
  });
});

export default router;
