import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  dashboardSummary,
  listOrders,
  getOrder,
  updatePricing,
  setDownPaymentReceived,
  confirmOrder,
  completeOrder,
} from "../controllers/adminOrderController.js";
import { salesReport, forecast } from "../controllers/reportController.js";

const router = Router();

// Every route in this file requires a logged-in admin
router.use(authenticate, authorize("admin"));

router.get("/ping", (req, res) => res.json({ message: "Admin access OK" }));
router.get("/dashboard", dashboardSummary);

router.get("/orders", listOrders);
router.get("/orders/:id", getOrder);
router.patch("/orders/:id/pricing", updatePricing);
router.patch("/orders/:id/down-payment-received", setDownPaymentReceived);
router.post("/orders/:id/confirm", confirmOrder);
router.post("/orders/:id/complete", completeOrder);

router.get("/reports/sales", salesReport);
router.get("/forecast", forecast);

export default router;
