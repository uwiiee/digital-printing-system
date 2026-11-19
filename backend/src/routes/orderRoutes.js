import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, authorize, optionalAuthenticate } from "../middleware/auth.js";
import { createOrder, listMyOrders, getMyOrder, trackOrder } from "../controllers/orderController.js";
import { customerThread, customerSend } from "../controllers/messageController.js";

const router = Router();

// Guests (no login) can order too, so the number of guest orders per address is limited
const guestOrderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.GUEST_ORDER_LIMIT) || 30,
  skip: (req) => Boolean(req.user),
  message: { message: "Too many orders from this connection. Please try again later." },
});

// Slows down guessing order codes
const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.TRACK_LIMIT) || 30,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

// Chat: limits per person, not per address
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => String(req.user._id),
  message: { message: "You are sending messages too quickly. Please wait a moment." },
});

// Open to guests
router.post("/", optionalAuthenticate, guestOrderLimiter, createOrder);
router.post("/track", trackLimiter, trackOrder);

// Logged-in customers only
router.use(authenticate, authorize("customer"));
router.get("/mine", listMyOrders); // must stay above "/:id"
router.get("/:id", getMyOrder);
router.get("/:id/messages", customerThread);
router.post("/:id/messages", messageLimiter, customerSend);

export default router;
