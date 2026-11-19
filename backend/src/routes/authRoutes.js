import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth.js";
import { register, loginCustomer, loginAdmin, changePassword } from "../controllers/authController.js";

const router = Router();

// Slows down password guessing
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Per user (not per IP): someone holding a stolen login token can't guess the current password quickly
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.user._id),
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

router.post("/register", register);
router.post("/login", loginLimiter, loginCustomer);
router.post("/admin/login", loginLimiter, loginAdmin);
router.patch("/password", authenticate, passwordLimiter, changePassword);

export default router;
