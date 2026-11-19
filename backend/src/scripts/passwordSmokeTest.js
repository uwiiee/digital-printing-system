// Checks "change password" against the running server. Uses a throwaway customer account.
import "dotenv/config";

const BASE = `http://localhost:${process.env.PORT || 5000}`;
let passed = 0;
let failed = 0;

function check(name, ok, r) {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} ${r ? `(status ${r.status}: ${r.data?.message ?? JSON.stringify(r.data)})` : ""}`);
  }
}

async function call(method, url, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const health = await call("GET", "/api/health").catch(() => null);
if (!health) {
  console.log(`Cannot reach ${BASE}. Start the server first.`);
  process.exit(1);
}

const email = `test-password-${Date.now()}@gmail.com`;
const OLD = "oldpassword1";
const NEW = "brandnewpass2";
const change = (token, body) => call("PATCH", "/api/auth/password", { token, body });

const reg = await call("POST", "/api/auth/register", { body: { email, password: OLD, confirmPassword: OLD } });
const tokenA = reg.data.token;
if (!tokenA) {
  console.log("Could not create the test account.", reg);
  process.exit(1);
}

let r = await change(undefined, { currentPassword: OLD, newPassword: NEW, confirmPassword: NEW });
check("1  no token gives 401", r.status === 401, r);
r = await change(tokenA, { currentPassword: "wrongpassword", newPassword: NEW, confirmPassword: NEW });
check("2  wrong current password is rejected (400)", r.status === 400 && /incorrect/i.test(r.data.message), r);
r = await change(tokenA, { currentPassword: OLD, newPassword: NEW, confirmPassword: "different123" });
check("3  new passwords that don't match are rejected (400)", r.status === 400, r);
r = await change(tokenA, { currentPassword: OLD, newPassword: "short", confirmPassword: "short" });
check("4  a new password under 8 characters is rejected (400)", r.status === 400, r);
r = await change(tokenA, { currentPassword: OLD, newPassword: "x".repeat(73), confirmPassword: "x".repeat(73) });
check("5  a new password over 72 bytes is rejected (400)", r.status === 400, r);
r = await change(tokenA, { currentPassword: OLD, newPassword: OLD, confirmPassword: OLD });
check("6  reusing the same password is rejected (400)", r.status === 400, r);
r = await change(tokenA, { newPassword: NEW, confirmPassword: NEW });
check("7  a missing current password is rejected (400)", r.status === 400, r);
r = await change(tokenA, { currentPassword: { $ne: "" }, newPassword: NEW, confirmPassword: NEW });
check("8  a non-text current password (injection attempt) is rejected (400)", r.status === 400, r);

const stillOld = await call("POST", "/api/auth/login", { body: { email, password: OLD } });
check("9  failed attempts changed nothing: the old password still works", stillOld.status === 200, stillOld);

// Tokens only go stale for a password change in a LATER second than they were issued
await sleep(1200);

const ok = await change(tokenA, { currentPassword: OLD, newPassword: NEW, confirmPassword: NEW });
const tokenB = ok.data.token;
check("10 a correct change succeeds and returns a fresh token", ok.status === 200 && !!tokenB, ok);

r = await call("POST", "/api/auth/login", { body: { email, password: OLD } });
check("11 the old password no longer logs in (401)", r.status === 401, r);
r = await call("POST", "/api/auth/login", { body: { email, password: NEW } });
check("12 the new password logs in", r.status === 200 && !!r.data.token, r);
r = await call("GET", "/api/orders/mine", { token: tokenA });
check("13 the old login token stops working (401): other devices are logged out", r.status === 401 && /password was changed/i.test(r.data.message), r);
r = await call("GET", "/api/orders/mine", { token: tokenB });
check("14 the fresh token keeps this device logged in", r.status === 200, r);

// Cleanup: the throwaway account is removed straight from the database
try {
  const { default: mongoose } = await import("mongoose");
  const { default: User } = await import("../models/User.js");
  await mongoose.connect(process.env.MONGODB_URI);
  await User.deleteOne({ email });
  await mongoose.disconnect();
  console.log("Test data cleaned up.");
} catch (err) {
  console.log("Cleanup failed. Delete the test-password user in Compass:", err.message);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
