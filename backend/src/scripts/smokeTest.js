// Checks products, ordering (guests and logged-in customers), design uploads and order tracking
// against the running server. Uses throwaway accounts and orders, and removes them afterwards.
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { uploadsDir } from "../config/uploads.js";

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const stamp = Date.now();
const PASSWORD = "password123";
const emailA = `test-a-${stamp}@gmail.com`;
const emailB = `test-b-${stamp}@gmail.com`;
const GUEST_NAME = `Test Guest ${stamp}`;
const GUEST_PHONE = "09171234567";

// A valid 1x1 PNG image, so no real file is needed
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

let passed = 0;
let failed = 0;
const uploaded = [];

function check(name, ok, r) {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    const detail = r ? `(status ${r.status}: ${r.data?.message ?? JSON.stringify(r.data)})` : "";
    console.log(`FAIL  ${name} ${detail}`);
  }
}

async function call(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + url, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const upload = (token, blob, filename) => {
  const form = new FormData();
  form.append("design", blob, filename);
  return call("POST", "/api/uploads/design", { token, form });
};

async function run() {
  const health = await call("GET", "/api/health").catch(() => null);
  if (!health) {
    console.log(`Cannot reach ${BASE}. Start the server first (npm run dev in another terminal).`);
    return;
  }

  // 1. Products
  const products = await call("GET", "/api/products");
  const list = Array.isArray(products.data) ? products.data : [];
  check("1  GET /api/products returns 4 products", list.length === 4, products);
  const jersey = list.find((p) => p.name === "Jersey");
  const tarp = list.find((p) => p.name === "Tarpaulin");
  if (!jersey || !tarp) {
    console.log("Run `npm run seed:products` first.");
    return;
  }

  // 2. Accounts
  const regA = await call("POST", "/api/auth/register", { body: { email: emailA, password: PASSWORD, confirmPassword: PASSWORD } });
  const loginA = await call("POST", "/api/auth/login", { body: { email: emailA, password: PASSWORD } });
  check("2  customer login returns a token", regA.status === 201 && loginA.status === 200 && !!loginA.data.token, loginA);
  const tokenA = loginA.data.token;
  const regB = await call("POST", "/api/auth/register", { body: { email: emailB, password: PASSWORD, confirmPassword: PASSWORD } });
  const tokenB = regB.data.token;
  const adminLogin = await call("POST", "/api/auth/admin/login", {
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  const tokenAdmin = adminLogin.data.token;
  if (!tokenA || !tokenB || !tokenAdmin) {
    console.log("Cannot continue without all three tokens. If admin login failed, run `npm run seed:admin`.");
    return;
  }

  // 3-4. Design upload (logged in)
  const up = await upload(tokenA, new Blob([PNG], { type: "image/png" }), "test.png");
  const uploadedPath = up.data.path;
  if (uploadedPath) uploaded.push(uploadedPath);
  check("3  a customer can upload a PNG", up.status === 201 && !!uploadedPath, up);
  if (uploadedPath) {
    const img = await fetch(BASE + uploadedPath);
    check("3b uploaded image can be opened", img.status === 200 && (img.headers.get("content-type") || "").startsWith("image/"));
  }
  const badUp = await upload(tokenA, new Blob(["hello"], { type: "text/plain" }), "test.txt");
  check("4  uploading a .txt is rejected (400)", badUp.status === 400, badUp);
  const adminUp = await upload(tokenAdmin, new Blob([PNG], { type: "image/png" }), "a.png");
  check("4b the admin cannot use the customer upload (403)", adminUp.status === 403, adminUp);

  // 5. A logged-in customer orders WITHOUT leaving a name or number
  const cart = () => ({
    items: [
      { productId: jersey._id, quantity: 2, specs: { size: "M", color: "Blue" }, designFile: uploadedPath },
      { productId: jersey._id, quantity: 1, specs: { size: "L", color: "Blue" } },
      { productId: tarp._id, quantity: 1, specs: { width: 4, height: 6 } },
    ],
    notes: "smoke test",
  });
  const expectedTotal = jersey.examplePrice * 3 + tarp.examplePrice * 4 * 6;
  const created = await call("POST", "/api/orders", { token: tokenA, body: cart() });
  check(
    `5  logged-in order needs no name or number: 201, Pending, total ${expectedTotal}`,
    created.status === 201 && created.data.status === "Pending" && created.data.estimatedTotal === expectedTotal && created.data.items?.length === 3,
    created
  );
  check("5b it gets a 6-character order code and belongs to the account", /^[A-Z2-9]{6}$/.test(created.data.code || "") && !!created.data.customer && created.data.contactName === "", created);

  // 6-8. Invalid carts are rejected
  let body = cart();
  body.items[0].specs.size = "XXL";
  let r = await call("POST", "/api/orders", { token: tokenA, body });
  check("6  invalid jersey size is rejected (400)", r.status === 400, r);
  body = cart();
  delete body.items[2].specs.height;
  r = await call("POST", "/api/orders", { token: tokenA, body });
  check("7  tarpaulin without height is rejected (400)", r.status === 400, r);
  body = cart();
  body.items = [];
  r = await call("POST", "/api/orders", { token: tokenA, body });
  check("8  empty cart is rejected (400)", r.status === 400, r);

  // 9. Contact details sent by a logged-in customer are ignored
  r = await call("POST", "/api/orders", { token: tokenA, body: { ...cart(), contactName: "Someone Else", contactNumber: "09990000000" } });
  check("9  a logged-in customer's name and number are not stored", r.status === 201 && r.data.contactName === "" && r.data.contactNumber === "", r);

  // 10. A customer sees only their own orders
  const mine = await call("GET", "/api/orders/mine", { token: tokenA });
  check("10 my orders shows exactly my 2 orders", Array.isArray(mine.data) && mine.data.length === 2, mine);

  // 11. Another customer cannot see it
  const orderId = created.data._id;
  r = await call("GET", `/api/orders/${orderId}`, { token: tokenB });
  check("11 another customer gets 404 for that order", r.status === 404, r);
  const mineB = await call("GET", "/api/orders/mine", { token: tokenB });
  check("11b other customer's order list is empty", Array.isArray(mineB.data) && mineB.data.length === 0, mineB);

  // 12. The admin cannot place orders; a bad or missing login behaves correctly
  r = await call("POST", "/api/orders", { token: tokenAdmin, body: cart() });
  check("12 admin token on the order route is forbidden (403)", r.status === 403, r);
  r = await call("POST", "/api/orders", { token: "not-a-real-token", body: cart() });
  check("12b a broken login token is refused (401), not treated as a guest", r.status === 401, r);

  // 13-16. Guest ordering (no account)
  const guestBody = () => ({ ...cart(), items: cart().items.slice(0, 1), contactName: GUEST_NAME, contactNumber: GUEST_PHONE });
  r = await call("POST", "/api/orders", { body: cart() });
  check("13 a guest without a name and number is rejected (400)", r.status === 400 && /name/i.test(r.data.message), r);
  r = await call("POST", "/api/orders", { body: { ...guestBody(), contactNumber: "abc" } });
  check("13b a guest with an invalid number is rejected (400)", r.status === 400, r);
  r = await call("POST", "/api/orders", { body: { ...guestBody(), contactName: "A" } });
  check("13c a guest with a one-letter name is rejected (400)", r.status === 400, r);

  const guestUp = await upload(undefined, new Blob([PNG], { type: "image/png" }), "guest.png");
  if (guestUp.data.path) uploaded.push(guestUp.data.path);
  check("14 a guest can upload a design too", guestUp.status === 201 && !!guestUp.data.path, guestUp);
  const guestOrder = await call("POST", "/api/orders", { body: { ...guestBody(), items: [{ ...cart().items[0], designFile: guestUp.data.path }] } });
  check(
    "15 a guest order works: 201, Pending, code, no account attached",
    guestOrder.status === 201 && guestOrder.data.status === "Pending" && /^[A-Z2-9]{6}$/.test(guestOrder.data.code || "") && !guestOrder.data.customer && guestOrder.data.contactName === GUEST_NAME,
    guestOrder
  );
  const guestCode = guestOrder.data.code;

  // 16. Guests do not appear in any customer's order list
  const mineAfter = await call("GET", "/api/orders/mine", { token: tokenA });
  check("16 a guest order is not in a customer's list", mineAfter.data.every((o) => o.code !== guestCode), mineAfter);
  r = await call("GET", `/api/orders/${guestOrder.data._id}`, { token: tokenA });
  check("16b a customer cannot open a guest order (404)", r.status === 404, r);

  // 17-19. Tracking a guest order
  r = await call("POST", "/api/orders/track", { body: { code: guestCode, contactNumber: GUEST_PHONE } });
  check("17 tracking with the right code and number works", r.status === 200 && r.data.code === guestCode && r.data.status === "Pending" && r.data.items.length === 1, r);
  check("17b the tracking answer shows no account or internal fields", !("customer" in r.data) && !("unreadForAdmin" in r.data) && !("_id" in r.data) && !("isSample" in r.data), r);
  r = await call("POST", "/api/orders/track", { body: { code: `#${guestCode.toLowerCase()}`, contactNumber: "+63 917 123 4567" } });
  check("17c a lowercase code with # and a +63 number still matches", r.status === 200, r);
  const wrongNumber = await call("POST", "/api/orders/track", { body: { code: guestCode, contactNumber: "09170000000" } });
  const wrongCode = await call("POST", "/api/orders/track", { body: { code: "ZZZZZZ", contactNumber: GUEST_PHONE } });
  check("18 a wrong number or a wrong code both give the same 404", wrongNumber.status === 404 && wrongCode.status === 404 && wrongNumber.data.message === wrongCode.data.message, wrongNumber);
  r = await call("POST", "/api/orders/track", { body: { code: created.data.code, contactNumber: GUEST_PHONE } });
  check("18b an order with an account can't be tracked this way (404)", r.status === 404, r);
  r = await call("POST", "/api/orders/track", { body: { code: { $ne: "" }, contactNumber: { $ne: "" } } });
  check("19 non-text input (injection attempt) is rejected (400)", r.status === 400, r);
  r = await call("POST", "/api/orders/track", { body: {} });
  check("19b missing input is rejected (400)", r.status === 400, r);

  // 20. The owner sees guest and account orders
  const adminList = await call("GET", "/api/admin/orders", { token: tokenAdmin });
  const gOrder = Array.isArray(adminList.data) ? adminList.data.find((o) => o.code === guestCode) : null;
  const aOrder = Array.isArray(adminList.data) ? adminList.data.find((o) => o._id === orderId) : null;
  check("20 the admin list shows the guest's name and number", gOrder?.contactName === GUEST_NAME && gOrder?.contactNumber === GUEST_PHONE && !gOrder?.customer, adminList);
  check("20b the admin list shows the account email for a logged-in order", aOrder?.customer?.email === emailA, adminList);

  // 21. Access control still holds
  r = await call("GET", "/api/admin/ping", { token: tokenA });
  check("21 a customer token on an admin route is forbidden (403)", r.status === 403, r);
  r = await call("GET", "/api/orders/mine");
  check("21b my orders without a login is refused (401)", r.status === 401, r);
}

async function cleanup() {
  // Deletes only the test users, their orders, the guest test orders, and the test images
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({ email: { $in: [emailA, emailB] } });
    const ids = users.map((u) => u._id);
    await Order.deleteMany({ $or: [{ customer: { $in: ids } }, { contactName: GUEST_NAME }] });
    await User.deleteMany({ _id: { $in: ids } });
    for (const p of uploaded) fs.rmSync(path.join(uploadsDir, path.basename(p)), { force: true });
    console.log("Test data cleaned up.");
  } catch (err) {
    console.log("Cleanup failed. Delete the test-... users and orders in Compass:", err.message);
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
