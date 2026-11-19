import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createOrder,
  listMyOrders,
  getMyOrder,
} from "../controllers/orderController.js";

const router = Router();
router.use(authenticate, authorize("customer"));

router.post("/", createOrder);
router.get("/mine", listMyOrders); // must stay above "/:id"
router.get("/:id", getMyOrder);

export default router;
