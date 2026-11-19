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

// A valid 1x1 PNG image, so no real file is needed
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let passed = 0;
let failed = 0;
let uploadedPath;

function check(name, ok, r) {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    const detail = r
      ? `(status ${r.status}: ${r.data?.message ?? JSON.stringify(r.data)})`
      : "";
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
    console.log(
      `Cannot reach ${BASE}. Start the server first (npm run dev in another terminal).`,
    );
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

  // 2. Customer accounts and login
  const regA = await call("POST", "/api/auth/register", {
    body: { email: emailA, password: PASSWORD, confirmPassword: PASSWORD },
  });
  check("   register customer A", regA.status === 201, regA);
  const loginA = await call("POST", "/api/auth/login", {
    body: { email: emailA, password: PASSWORD },
  });
  check(
    "2  customer login returns a token",
    loginA.status === 200 && !!loginA.data.token,
    loginA,
  );
  const tokenA = loginA.data.token;

  const regB = await call("POST", "/api/auth/register", {
    body: { email: emailB, password: PASSWORD, confirmPassword: PASSWORD },
  });
  check("   register customer B", regB.status === 201, regB);
  const tokenB = regB.data.token;

  const adminLogin = await call("POST", "/api/auth/admin/login", {
    body: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  check("   admin login", adminLogin.status === 200, adminLogin);
  const tokenAdmin = adminLogin.data.token;

  if (!tokenA || !tokenB || !tokenAdmin) {
    console.log(
      "Cannot continue without all three tokens. If admin login failed, run `npm run seed:admin`.",
    );
    return;
  }

  // 3-4. Design upload
  const up = await upload(
    tokenA,
    new Blob([PNG], { type: "image/png" }),
    "test.png",
  );
  uploadedPath = up.data.path;
  check("3  upload a PNG", up.status === 201 && !!uploadedPath, up);
  if (uploadedPath) {
    const img = await fetch(BASE + uploadedPath);
    check(
      "3b uploaded image can be opened",
      img.status === 200 &&
        (img.headers.get("content-type") || "").startsWith("image/"),
    );
  }
  const badUp = await upload(
    tokenA,
    new Blob(["hello"], { type: "text/plain" }),
    "test.txt",
  );
  check("4  uploading a .txt is rejected (400)", badUp.status === 400, badUp);

  // 5. Valid order
  const goodBody = () => ({
    items: [
      {
        productId: jersey._id,
        quantity: 2,
        specs: { size: "M", color: "Blue" },
        designFile: uploadedPath,
      },
      {
        productId: jersey._id,
        quantity: 1,
        specs: { size: "L", color: "Blue" },
      },
      { productId: tarp._id, quantity: 1, specs: { width: 4, height: 6 } },
    ],
    notes: "smoke test",
    contactName: "Test Customer",
    contactNumber: "09171234567",
  });

  const expectedTotal = jersey.examplePrice * 3 + tarp.examplePrice * 4 * 6;
  const created = await call("POST", "/api/orders", {
    token: tokenA,
    body: goodBody(),
  });
  check(
    `5  valid order: 201, Pending, total ${expectedTotal}`,
    created.status === 201 &&
      created.data.status === "Pending" &&
      created.data.estimatedTotal === expectedTotal &&
      created.data.items?.length === 3,
    created,
  );

  // 6-9. Invalid orders must be rejected
  let body = goodBody();
  body.items[0].specs.size = "XXL";
  let r = await call("POST", "/api/orders", { token: tokenA, body });
  check("6  invalid jersey size is rejected (400)", r.status === 400, r);

  body = goodBody();
  delete body.items[2].specs.height;
  r = await call("POST", "/api/orders", { token: tokenA, body });
  check("7  tarpaulin without height is rejected (400)", r.status === 400, r);

  body = goodBody();
  body.items = [];
  r = await call("POST", "/api/orders", { token: tokenA, body });
  check("8  empty cart is rejected (400)", r.status === 400, r);

  body = goodBody();
  delete body.contactNumber;
  r = await call("POST", "/api/orders", { token: tokenA, body });
  check("9  missing contact number is rejected (400)", r.status === 400, r);

  // 10. Customer sees only their own orders
  const mine = await call("GET", "/api/orders/mine", { token: tokenA });
  check(
    "10 my orders shows exactly 1 order with 3 lines",
    Array.isArray(mine.data) &&
      mine.data.length === 1 &&
      mine.data[0].items.length === 3,
    mine,
  );

  // 11. Another customer cannot see it
  const orderId = created.data._id;
  r = await call("GET", `/api/orders/${orderId}`, { token: tokenB });
  check("11 another customer gets 404 for that order", r.status === 404, r);
  const mineB = await call("GET", "/api/orders/mine", { token: tokenB });
  check(
    "11b other customer's order list is empty",
    Array.isArray(mineB.data) && mineB.data.length === 0,
    mineB,
  );

  // 12. Admin cannot place customer orders, and anonymous users are blocked
  r = await call("POST", "/api/orders", {
    token: tokenAdmin,
    body: goodBody(),
  });
  check(
    "12 admin token on customer order route is forbidden (403)",
    r.status === 403,
    r,
  );
  r = await call("POST", "/api/orders", { body: goodBody() });
  check("   no token on order route gives 401", r.status === 401, r);
  r = await call("GET", "/api/admin/ping", { token: tokenA });
  check(
    "   customer token on admin route is forbidden (403)",
    r.status === 403,
    r,
  );
}

async function cleanup() {
  // Deletes only the test users, their orders, and the test image
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({ email: { $in: [emailA, emailB] } });
    const ids = users.map((u) => u._id);
    await Order.deleteMany({ customer: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    if (uploadedPath)
      fs.rmSync(path.join(uploadsDir, path.basename(uploadedPath)), {
        force: true,
      });
    console.log("Test data cleaned up.");
  } catch (err) {
    console.log(
      "Cleanup failed, delete the test-... users and their orders in Compass:",
      err.message,
    );
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
