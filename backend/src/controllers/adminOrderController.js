import mongoose from "mongoose";
import Order, { ORDER_STATUSES } from "../models/Order.js";
import { resolveSource } from "../services/dataSource.js";
import { includesDemo } from "../services/demoData.js";
import { manilaDayStart, manilaMonthStart } from "../services/dateRanges.js";

const MAX_PRICE = 10_000_000;
const REAL_ONLY = { isSample: { $ne: true } }; // demo orders never appear in the real order screens

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

async function loadOrder(id) {
  if (!mongoose.isValidObjectId(id)) fail(404, "Order not found");
  const order = await Order.findById(id);
  if (!order) fail(404, "Order not found");
  return order;
}

// Accepts a number or a numeric string, rejects everything else
function money(value, label) {
  if (typeof value !== "number" && typeof value !== "string") fail(400, `${label} must be a valid amount`);
  if (typeof value === "string" && value.trim() === "") fail(400, `${label} must be a valid amount`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) fail(400, `${label} must be a valid amount`);
  return Math.round(n * 100) / 100;
}

async function sendOrder(res, order) {
  await order.populate("customer", "email");
  res.json(order);
}

const LIST_FIELDS = "contactName status estimatedTotal finalPrice createdAt items.quantity downPayment";

// A short version of an order, for the dashboard lists
const brief = (o) => ({
  _id: o._id,
  contactName: o.contactName,
  status: o.status,
  itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
  estimatedTotal: o.estimatedTotal,
  finalPrice: o.finalPrice,
  downPaymentAmount: o.downPayment?.amount ?? 0,
  createdAt: o.createdAt,
});

export async function dashboardSummary(req, res, next) {
  try {
    // The queue of work (counts, lists) is always REAL orders only.
    // The month figures follow the same dataset as the reports (demo orders count when INCLUDE_DEMO_DATA=true).
    const { name, filter } = resolveSource(req.query);
    const now = new Date();

    const [statusRows, ordersToday, month, pending, awaiting, recent, demo] = await Promise.all([
      Order.aggregate([{ $match: REAL_ONLY }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.countDocuments({ ...REAL_ONLY, createdAt: { $gte: manilaDayStart(now) } }),
      Order.aggregate([
        { $match: { ...filter, status: "Completed", completedAt: { $gte: manilaMonthStart(now) } } },
        { $group: { _id: null, revenue: { $sum: "$finalPrice" }, orders: { $sum: 1 } } },
      ]),
      Order.find({ ...REAL_ONLY, status: "Pending" }).sort({ createdAt: 1 }).limit(5).select(LIST_FIELDS).lean(),
      Order.find({
        ...REAL_ONLY,
        status: { $ne: "Completed" },
        "downPayment.requested": true,
        "downPayment.received": false,
      })
        .sort({ createdAt: 1 })
        .limit(5)
        .select(LIST_FIELDS)
        .lean(),
      Order.find(REAL_ONLY).sort({ createdAt: -1 }).limit(5).select(LIST_FIELDS).lean(),
      includesDemo(name),
    ]);

    const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
    for (const r of statusRows) counts[r._id] = r.count;

    res.json({
      includesDemoData: demo,
      counts,
      ordersToday,
      month: {
        revenue: Math.round((month[0]?.revenue ?? 0) * 100) / 100,
        orders: month[0]?.orders ?? 0,
      },
      needsAttention: pending.map(brief),
      awaitingDownPayment: awaiting.map(brief),
      recent: recent.map(brief),
    });
  } catch (err) {
    next(err);
  }
}

export async function listOrders(req, res, next) {
  try {
    const filter = { ...REAL_ONLY };
    if (req.query.status) {
      if (!ORDER_STATUSES.includes(req.query.status)) fail(400, "Invalid status");
      filter.status = req.query.status;
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200).populate("customer", "email");
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req, res, next) {
  try {
    await sendOrder(res, await loadOrder(req.params.id));
  } catch (err) {
    next(err);
  }
}

// Sets the final price and the optional down-payment request
export async function updatePricing(req, res, next) {
  try {
    const order = await loadOrder(req.params.id);
    if (order.status === "Completed") fail(409, "Completed orders can't be changed");

    const price = money(req.body.finalPrice, "Final price");
    const requested = req.body.downPayment?.requested === true;

    let dp;
    if (order.downPayment.received) {
      // Money was already received: the down payment is locked
      dp = {
        requested: order.downPayment.requested,
        amount: order.downPayment.amount,
        received: true,
      };
      if (price < dp.amount) fail(400, "Final price can't be lower than the down payment already received");
    } else if (requested) {
      const amount = money(req.body.downPayment.amount, "Down payment");
      if (amount <= 0) fail(400, "Down payment must be more than 0");
      if (amount > price) fail(400, "Down payment can't be more than the final price");
      dp = { requested: true, amount, received: false };
    } else {
      dp = { requested: false, amount: 0, received: false };
    }

    order.finalPrice = price;
    order.downPayment = dp;
    await order.save();
    await sendOrder(res, order);
  } catch (err) {
    next(err);
  }
}

export async function setDownPaymentReceived(req, res, next) {
  try {
    const order = await loadOrder(req.params.id);
    if (!order.downPayment.requested) fail(409, "No down payment was requested for this order");
    if (typeof req.body.received !== "boolean") fail(400, "received must be true or false");

    order.downPayment.received = req.body.received;
    await order.save();
    await sendOrder(res, order);
  } catch (err) {
    next(err);
  }
}

// Pending -> On Process
export async function confirmOrder(req, res, next) {
  try {
    const order = await loadOrder(req.params.id);
    if (order.status !== "Pending") fail(409, "Only pending orders can be confirmed");
    if (order.finalPrice == null) fail(400, "Set the final price before confirming");

    // The status check in the filter stops two quick clicks from both succeeding
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: "Pending" },
      { $set: { status: "On Process", confirmedAt: new Date() } },
      { new: true }
    ).populate("customer", "email");
    if (!updated) fail(409, "This order was already updated");
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// On Process -> Completed (the customer picked it up)
export async function completeOrder(req, res, next) {
  try {
    const order = await loadOrder(req.params.id);
    if (order.status !== "On Process") fail(409, "Only orders that are On Process can be completed");

    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: "On Process" },
      { $set: { status: "Completed", completedAt: new Date() } },
      { new: true }
    ).populate("customer", "email");
    if (!updated) fail(409, "This order was already updated");
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
