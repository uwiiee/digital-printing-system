import mongoose from "mongoose";
import Order from "../models/Order.js";
import Message from "../models/Message.js";

const MAX_TEXT = 1000;
const THREAD_LIMIT = 200;

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

function cleanText(text) {
  if (typeof text !== "string" || text.trim() === "") fail(400, "Write a message first");
  const trimmed = text.trim();
  if (trimmed.length > MAX_TEXT) fail(400, `Messages can be up to ${MAX_TEXT} characters`);
  return trimmed;
}

// The newest messages, oldest first
async function thread(order) {
  const rows = await Message.find({ order: order._id }).sort({ createdAt: -1 }).limit(THREAD_LIMIT).lean();
  return rows.reverse().map((m) => ({ _id: m._id, sender: m.sender, text: m.text, createdAt: m.createdAt }));
}

async function send(order, sender, text) {
  const message = await Message.create({ order: order._id, sender, text });
  const unreadField = sender === "admin" ? "unreadForCustomer" : "unreadForAdmin";
  await Order.updateOne({ _id: order._id }, { $inc: { [unreadField]: 1 }, $set: { lastMessageAt: message.createdAt } });
  return { _id: message._id, sender: message.sender, text: message.text, createdAt: message.createdAt };
}

// ---- Customer side: only the customer's own orders ----

async function ownOrder(req) {
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, "Order not found");
  const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
  if (!order) fail(404, "Order not found");
  return order;
}

export async function customerThread(req, res, next) {
  try {
    const order = await ownOrder(req);
    const messages = await thread(order);
    if (order.unreadForCustomer > 0) await Order.updateOne({ _id: order._id }, { $set: { unreadForCustomer: 0 } });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function customerSend(req, res, next) {
  try {
    const order = await ownOrder(req);
    res.status(201).json(await send(order, "customer", cleanText(req.body.text)));
  } catch (err) {
    next(err);
  }
}

// ---- Admin side: any order that belongs to an account ----

async function anyOrder(req) {
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, "Order not found");
  const order = await Order.findById(req.params.id);
  if (!order) fail(404, "Order not found");
  return order;
}

export async function adminThread(req, res, next) {
  try {
    const order = await anyOrder(req);
    const messages = await thread(order);
    if (order.unreadForAdmin > 0) await Order.updateOne({ _id: order._id }, { $set: { unreadForAdmin: 0 } });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function adminSend(req, res, next) {
  try {
    const order = await anyOrder(req);
    if (!order.customer) fail(409, `This is a guest order, so there is no chat. Contact the customer at ${order.contactNumber}.`);
    res.status(201).json(await send(order, "admin", cleanText(req.body.text)));
  } catch (err) {
    next(err);
  }
}
