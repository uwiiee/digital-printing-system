import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { validateSpecs, estimateUnitPrice } from "../services/orderService.js";
import { generateOrderCode, normalizeOrderCode } from "../services/orderCode.js";
import { samePhone } from "../services/phone.js";

const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;
const DESIGN_REGEX = /^\/uploads\/[a-f0-9-]{36}\.(png|jpg|webp)$/;
const bad = (res, message) => res.status(400).json({ message });

// Works for guests (no login) and for logged-in customers
export async function createOrder(req, res, next) {
  try {
    if (req.user && req.user.role !== "customer")
      return res.status(403).json({ message: "Admin accounts can't place orders" });
    const guest = !req.user;

    const { items, notes = "", contactName, contactNumber } = req.body;

    if (!Array.isArray(items) || items.length < 1 || items.length > 50)
      return bad(res, "Your cart must have 1 to 50 items");
    if (typeof notes !== "string" || notes.length > 1000) return bad(res, "Notes are too long");

    // Guests must say who they are. Logged-in customers don't: the shop chats with them.
    if (guest) {
      if (typeof contactName !== "string" || contactName.trim().length < 2) return bad(res, "Enter your name");
      if (typeof contactNumber !== "string" || !PHONE_REGEX.test(contactNumber.trim()))
        return bad(res, "Enter a valid contact number");
    }

    const ids = items.map((i) => i?.productId);
    if (!ids.every((id) => mongoose.isValidObjectId(id))) return bad(res, "Invalid product in cart");

    const products = await Product.find({ _id: { $in: ids }, isActive: true });
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const orderItems = [];
    let estimatedTotal = 0;

    for (const item of items) {
      const product = byId.get(String(item.productId));
      if (!product) return bad(res, "A product in your cart is no longer available");

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000)
        return bad(res, "Invalid quantity in cart");

      const designFile = item.designFile || "";
      if (designFile && !DESIGN_REGEX.test(designFile)) return bad(res, "Invalid design file");

      const specs = validateSpecs(product, item.specs); // throws a 400 on bad answers
      const estimatedUnitPrice = estimateUnitPrice(product, specs);
      estimatedTotal += estimatedUnitPrice * quantity;

      orderItems.push({
        product: product._id,
        productName: product.name,
        examplePrice: product.examplePrice,
        priceUnit: product.priceUnit,
        estimatedUnitPrice,
        specs,
        quantity,
        designFile,
      });
    }

    const data = {
      customer: guest ? null : req.user._id, // from the login, never from the request body
      items: orderItems,
      notes: notes.trim(),
      contactName: guest ? contactName.trim() : "",
      contactNumber: guest ? contactNumber.trim() : "",
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    };

    // A random code is almost always free. In the rare clash, try another one.
    let order = null;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      try {
        order = await Order.create({ ...data, code: generateOrderCode() });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    if (!order) throw new Error("Could not create a unique order code");

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

export async function listMyOrders(req, res, next) {
  try {
    res.json(await Order.find({ customer: req.user._id }).sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
}

export async function getMyOrder(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ message: "Order not found" });
    // Filtering by customer makes other people's orders look like they don't exist
    const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
}

// Lets a guest check an order with the order code plus the contact number they gave
export async function trackOrder(req, res, next) {
  try {
    const { code, contactNumber } = req.body;
    if (typeof code !== "string" || typeof contactNumber !== "string" || !code.trim() || !contactNumber.trim())
      return bad(res, "Enter your order code and the contact number you gave");

    // Only guest orders can be looked up this way. Accounts see their orders after logging in.
    const order = await Order.findOne({ code: normalizeOrderCode(code), customer: null }).lean();

    // The same answer for a wrong code and a wrong number, so nobody can probe for valid codes
    if (!order || !samePhone(order.contactNumber, contactNumber))
      return res.status(404).json({ message: "No order found with that code and number" });

    res.json({
      code: order.code,
      status: order.status,
      items: order.items,
      notes: order.notes,
      contactName: order.contactName,
      estimatedTotal: order.estimatedTotal,
      finalPrice: order.finalPrice,
      downPayment: order.downPayment,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      completedAt: order.completedAt,
    });
  } catch (err) {
    next(err);
  }
}
