import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const email = `test-adminflow-${Date.now()}@gmail.com`;
const PASSWORD = "password123";
let passed = 0;
let failed = 0;

function check(name, ok, r) {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(
      `FAIL  ${name} ${r ? `(status ${r.status}: ${r.data?.message ?? JSON.stringify(r.data)})` : ""}`,
    );
  }
}

async function call(method, url, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function run() {
  const health = await call("GET", "/api/health").catch(() => null);
  if (!health)
    return console.log(`Cannot reach ${BASE}. Start the server first.`);

  const products = await call("GET", "/api/products");
  const list = Array.isArray(products.data) ? products.data : [];
  const jersey = list.find((p) => p.name === "Jersey");
  const tarp = list.find((p) => p.name === "Tarpaulin");
  if (!jersey || !tarp)
    return console.log("Run `npm run seed:products` first.");

  const reg = await call("POST", "/api/auth/register", {
    body: { email, password: PASSWORD, confirmPassword: PASSWORD },
  });
  const cust = reg.data.token;
  const adminLogin = await call("POST", "/api/auth/admin/login", {
    body: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  const adm = adminLogin.data.token;
  if (!cust || !adm)
    return console.log(
      "Could not log in. Run `npm run seed:admin` if the admin is missing.",
    );

  const created = await call("POST", "/api/orders", {
    token: cust,
    body: {
      items: [
        {
          productId: jersey._id,
          quantity: 2,
          specs: { size: "M", color: "Blue" },
        },
        { productId: tarp._id, quantity: 1, specs: { width: 4, height: 6 } },
      ],
      contactName: "Test Customer",
      contactNumber: "09171234567",
    },
  });
  check("   customer places an order", created.status === 201, created);
  const id = created.data._id;
  const A = `/api/admin/orders/${id}`;
  const admin = (method, url, body) => call(method, url, { token: adm, body });

  // Listing and access control
  const all = await admin("GET", "/api/admin/orders");
  const found = Array.isArray(all.data)
    ? all.data.find((o) => o._id === id)
    : null;
  check(
    "1  admin list includes the order with the customer's email",
    !!found && found.customer?.email === email,
    all,
  );
  const pend = await admin("GET", "/api/admin/orders?status=Pending");
  check(
    "2  status filter works",
    Array.isArray(pend.data) &&
      pend.data.some((o) => o._id === id) &&
      pend.data.every((o) => o.status === "Pending"),
    pend,
  );
  const badFilter = await admin("GET", "/api/admin/orders?status=Bogus");
  check(
    "3  invalid status filter is rejected (400)",
    badFilter.status === 400,
    badFilter,
  );
  let r = await call("GET", "/api/admin/orders", { token: cust });
  check("4  customer cannot list admin orders (403)", r.status === 403, r);
  r = await call("GET", "/api/admin/orders");
  check("5  no token gives 401", r.status === 401, r);
  r = await call("POST", `${A}/confirm`, { token: cust });
  check("6  customer cannot confirm an order (403)", r.status === 403, r);

  // Rules before confirming
  r = await admin("POST", `${A}/confirm`);
  check(
    "7  confirm without a final price is rejected (400)",
    r.status === 400,
    r,
  );
  r = await admin("PATCH", `${A}/pricing`, { finalPrice: -5 });
  check("8  negative price is rejected (400)", r.status === 400, r);
  r = await admin("PATCH", `${A}/pricing`, { finalPrice: "abc" });
  check("9  non-numeric price is rejected (400)", r.status === 400, r);
  r = await admin("PATCH", `${A}/pricing`, {
    finalPrice: 1500,
    downPayment: { requested: true, amount: 2000 },
  });
  check(
    "10 down payment above the price is rejected (400)",
    r.status === 400,
    r,
  );
  r = await admin("POST", `${A}/complete`);
  check("11 completing a Pending order is rejected (409)", r.status === 409, r);

  // Price and down payment
  r = await admin("PATCH", `${A}/pricing`, {
    finalPrice: 1500,
    downPayment: { requested: true, amount: 500 },
  });
  check(
    "12 set price 1500 with a 500 down payment",
    r.status === 200 &&
      r.data.finalPrice === 1500 &&
      r.data.downPayment.amount === 500,
    r,
  );
  r = await admin("PATCH", `${A}/down-payment-received`, { received: true });
  check(
    "13 mark the down payment received",
    r.status === 200 && r.data.downPayment.received === true,
    r,
  );
  r = await admin("PATCH", `${A}/pricing`, {
    finalPrice: 1500,
    downPayment: { requested: false },
  });
  check(
    "14 a received down payment can't be removed",
    r.status === 200 &&
      r.data.downPayment.requested === true &&
      r.data.downPayment.amount === 500,
    r,
  );
  r = await admin("PATCH", `${A}/pricing`, { finalPrice: 400 });
  check(
    "15 price below the received down payment is rejected (400)",
    r.status === 400,
    r,
  );

  // Status flow
  r = await admin("POST", `${A}/confirm`);
  check(
    "16 confirm: Pending to On Process",
    r.status === 200 && r.data.status === "On Process" && !!r.data.confirmedAt,
    r,
  );
  r = await admin("POST", `${A}/confirm`);
  check("17 confirming twice is rejected (409)", r.status === 409, r);

  const mine = await call("GET", "/api/orders/mine", { token: cust });
  const seen = Array.isArray(mine.data)
    ? mine.data.find((o) => o._id === id)
    : null;
  check(
    "18 customer sees On Process and the final price",
    seen?.status === "On Process" && seen?.finalPrice === 1500,
    mine,
  );

  r = await admin("POST", `${A}/complete`);
  check(
    "19 complete: On Process to Completed",
    r.status === 200 && r.data.status === "Completed" && !!r.data.completedAt,
    r,
  );
  r = await admin("POST", `${A}/complete`);
  check("20 completing twice is rejected (409)", r.status === 409, r);
  r = await admin("PATCH", `${A}/pricing`, { finalPrice: 100 });
  check("21 completed orders can't be edited (409)", r.status === 409, r);

  const dash = await admin("GET", "/api/admin/dashboard");
  const c = dash.data.counts || {};
  check(
    "22 dashboard counts include all three statuses",
    dash.status === 200 &&
      ["Pending", "On Process", "Completed"].every(
        (s) => typeof c[s] === "number",
      ) &&
      c.Completed >= 1,
    dash,
  );
}

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({ email });
    const ids = users.map((u) => u._id);
    await Order.deleteMany({ customer: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    console.log("Test data cleaned up.");
  } catch (err) {
    console.log(
      "Cleanup failed. Delete the test-adminflow user and its order in Compass:",
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
