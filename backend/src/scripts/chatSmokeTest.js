// Checks the order chat (logged-in customer <-> owner), unread counts, and the dashboard's message list.
// Uses throwaway accounts and orders, and removes them afterwards.
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Message from "../models/Message.js";

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const stamp = Date.now();
const PASSWORD = "password123";
const emails = { a: `test-chat-a-${stamp}@gmail.com`, b: `test-chat-b-${stamp}@gmail.com`, c: `test-chat-c-${stamp}@gmail.com` };
const GUEST_NAME = `Chat Guest ${stamp}`;

let passed = 0;
let failed = 0;
function check(name, ok, r) {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} ${r ? `(status ${r.status}: ${r.data?.message ?? JSON.stringify(r.data).slice(0, 200)})` : ""}`);
  }
}

async function call(method, url, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function run() {
  const health = await call("GET", "/api/health").catch(() => null);
  if (!health) return console.log(`Cannot reach ${BASE}. Start the server first.`);

  const products = (await call("GET", "/api/products")).data;
  const jersey = Array.isArray(products) ? products.find((p) => p.name === "Jersey") : null;
  if (!jersey) return console.log("Run `npm run seed:products` first.");

  const reg = async (email) => (await call("POST", "/api/auth/register", { body: { email, password: PASSWORD, confirmPassword: PASSWORD } })).data.token;
  const A = await reg(emails.a);
  const B = await reg(emails.b);
  const C = await reg(emails.c);
  const admin = (await call("POST", "/api/auth/admin/login", { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).data.token;
  if (!A || !B || !C || !admin) return console.log("Could not log in. If the admin failed, run `npm run seed:admin`.");

  const cartBody = { items: [{ productId: jersey._id, quantity: 1, specs: { size: "M", color: "Blue" } }] };
  const orderA = (await call("POST", "/api/orders", { token: A, body: cartBody })).data;
  const orderC = (await call("POST", "/api/orders", { token: C, body: cartBody })).data;
  const guest = (await call("POST", "/api/orders", { body: { ...cartBody, contactName: GUEST_NAME, contactNumber: "09175550000" } })).data;
  if (!orderA._id || !orderC._id || !guest._id) return console.log("Could not create the test orders.");

  const T = `/api/orders/${orderA._id}/messages`;
  const AT = `/api/admin/orders/${orderA._id}/messages`;
  const mineA = async () => (await call("GET", "/api/orders/mine", { token: A })).data.find((o) => o._id === orderA._id);
  const adminRow = async (id) => (await call("GET", "/api/admin/orders", { token: admin })).data.find((o) => o._id === id);

  // --- Customer sends ---
  let r = await call("POST", T, { token: A, body: { text: "  Hello, is my design OK?  " } });
  check("1  a customer can send a message (text is trimmed)", r.status === 201 && r.data.text === "Hello, is my design OK?" && r.data.sender === "customer", r);
  for (const [label, text] of [["empty", ""], ["spaces only", "   "], ["not text", { a: 1 }], ["missing", undefined], ["over 1000 characters", "x".repeat(1001)]]) {
    r = await call("POST", T, { token: A, body: text === undefined ? {} : { text } });
    check(`2  a ${label} message is rejected (400)`, r.status === 400, r);
  }
  r = await call("POST", T, { token: A, body: { text: "<script>alert(1)</script>" } });
  check("3  markup is kept as plain text, exactly as typed", r.status === 201 && r.data.text === "<script>alert(1)</script>", r);

  // --- Privacy ---
  r = await call("GET", T, { token: B });
  check("4  another customer cannot read the thread (404)", r.status === 404, r);
  r = await call("POST", T, { token: B, body: { text: "hi" } });
  check("4b another customer cannot post into it (404)", r.status === 404, r);
  r = await call("GET", T);
  check("4c no login is refused (401)", r.status === 401, r);
  r = await call("GET", "/api/orders/not-an-id/messages", { token: A });
  check("4d a malformed order id gives 404", r.status === 404, r);
  r = await call("GET", AT, { token: A });
  check("4e a customer cannot use the admin chat route (403)", r.status === 403, r);

  // --- Unread counts reach the owner ---
  let row = await adminRow(orderA._id);
  check("5  the owner's order list shows 2 unread messages", row?.unreadForAdmin === 2, row);
  let dash = (await call("GET", "/api/admin/dashboard", { token: admin })).data;
  const inQueue = dash.messages?.orders?.find((o) => o._id === orderA._id);
  check("5b the dashboard lists that order with its unread count", dash.messages?.unread >= 2 && inQueue?.unread === 2, { status: 200, data: dash.messages });
  check("5d the dashboard shows the same order code as the order itself", /^[A-Z2-9]{6}$/.test(orderA.code || "") && inQueue?.code === orderA.code, { status: 200, data: inQueue });
  check("5c a logged-in customer appears by email on the dashboard", inQueue?.contactName === emails.a && inQueue?.guest === false, { status: 200, data: inQueue });

  // --- Owner reads and replies ---
  r = await call("GET", AT, { token: admin });
  check("6  the owner reads the thread, oldest first", r.status === 200 && r.data.messages.length === 2 && r.data.messages[0].text === "Hello, is my design OK?", r);
  row = await adminRow(orderA._id);
  check("6b reading clears the owner's unread count", row?.unreadForAdmin === 0, row);

  r = await call("POST", AT, { token: admin, body: { text: "Yes! The price will be 1,500. Please send a 500 down payment." } });
  check("7  the owner can reply", r.status === 201 && r.data.sender === "admin", r);
  check("7b the customer now has 1 unread message", (await mineA())?.unreadForCustomer === 1);
  r = await call("GET", T, { token: A });
  check("7c the customer reads the thread (3 messages, in order)", r.status === 200 && r.data.messages.length === 3 && r.data.messages.at(-1).sender === "admin", r);
  check("7d reading clears the customer's unread count", (await mineA())?.unreadForCustomer === 0);

  // --- Guests have no chat ---
  r = await call("POST", `/api/admin/orders/${guest._id}/messages`, { token: admin, body: { text: "hello" } });
  check("8  the owner can't chat on a guest order: 409 with the phone number", r.status === 409 && /09175550000/.test(r.data.message), r);
  dash = (await call("GET", "/api/admin/dashboard", { token: admin })).data;
  check("8b guest orders show on the dashboard marked as guest, with their own name", [...dash.needsAttention, ...dash.recent].some((o) => o._id === guest._id && o.guest === true && o.contactName === GUEST_NAME), { status: 200, data: dash.recent });

  // --- Access control on the admin side ---
  r = await call("POST", AT, { body: { text: "hi" } });
  check("9  no login on the admin chat route is refused (401)", r.status === 401, r);
  r = await call("POST", AT, { token: admin, body: { text: "" } });
  check("9b an empty owner message is rejected (400)", r.status === 400, r);
  r = await call("GET", "/api/admin/orders/000000000000000000000000/messages", { token: admin });
  check("9c an unknown order gives 404", r.status === 404, r);

  // --- Long threads keep the newest messages ---
  const orderC2 = orderC._id;
  for (let i = 1; i <= 25; i++) await call("POST", `/api/admin/orders/${orderC2}/messages`, { token: admin, body: { text: `msg ${i}` } });
  r = await call("GET", `/api/orders/${orderC2}/messages`, { token: C });
  check("10 25 messages come back in order", r.status === 200 && r.data.messages.length === 25 && r.data.messages[0].text === "msg 1" && r.data.messages[24].text === "msg 25", r);

  // --- Message flood is limited per person ---
  let limited = 0;
  for (let i = 0; i < 35; i++) {
    const x = await call("POST", `/api/orders/${orderC2}/messages`, { token: C, body: { text: `spam ${i}` } });
    if (x.status === 429) limited++;
  }
  check("11 sending more than 30 messages in a minute gets limited (429)", limited >= 1, { status: 0, data: { message: `${limited} limited` } });
  r = await call("POST", T, { token: A, body: { text: "still fine for others" } });
  check("11b another customer is not affected by that limit", r.status === 201, r);
}

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({ email: { $in: Object.values(emails) } });
    const userIds = users.map((u) => u._id);
    const orders = await Order.find({ $or: [{ customer: { $in: userIds } }, { contactName: GUEST_NAME }] }).select("_id");
    const orderIds = orders.map((o) => o._id);
    await Message.deleteMany({ order: { $in: orderIds } });
    await Order.deleteMany({ _id: { $in: orderIds } });
    await User.deleteMany({ _id: { $in: userIds } });
    console.log("Test data cleaned up.");
  } catch (err) {
    console.log("Cleanup failed. Delete the test-chat users, their orders and messages in Compass:", err.message);
  } finally {
    await mongoose.disconnect();
  }
}

try {
  await run();
} finally {
  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
