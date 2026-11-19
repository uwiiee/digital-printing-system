// Checks the report and forecast endpoints against the running server.
// Run `npm run seed:sample` first so there is demo data to check.
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
    console.log(`FAIL  ${name} ${r ? `(status ${r.status}: ${r.data?.message ?? JSON.stringify(r.data).slice(0, 200)})` : ""}`);
  }
}

async function call(url, token) {
  const res = await fetch(BASE + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function login(path, body) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({}))).token;
}

const health = await call("/api/health").catch(() => null);
if (!health) {
  console.log(`Cannot reach ${BASE}. Start the server first.`);
  process.exit(1);
}

const admin = await login("/api/auth/admin/login", { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
if (!admin) {
  console.log("Admin login failed. Run `npm run seed:admin`.");
  process.exit(1);
}

// Access control
let r = await call("/api/admin/reports/sales");
check("1  no token on reports gives 401", r.status === 401, r);
r = await call("/api/admin/forecast");
check("2  no token on forecast gives 401", r.status === 401, r);

const email = `test-reports-${Date.now()}@gmail.com`;
const reg = await fetch(BASE + "/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "password123", confirmPassword: "password123" }),
});
const customer = (await reg.json()).token;
r = await call("/api/admin/reports/sales", customer);
check("3  a customer cannot read reports (403)", r.status === 403, r);
r = await call("/api/admin/forecast", customer);
check("4  a customer cannot read the forecast (403)", r.status === 403, r);

// Input checks
r = await call("/api/admin/reports/sales?source=bogus", admin);
check("5  an invalid source is rejected (400)", r.status === 400, r);
r = await call("/api/admin/forecast?source=sample&horizon=99", admin);
check("6  an invalid horizon is rejected (400)", r.status === 400, r);

// Sample data
const sales = await call("/api/admin/reports/sales?source=sample", admin);
if (sales.status === 200 && sales.data.summary.orders === 0) {
  console.log("\nNo sample data found. Run `npm run seed:sample`, then run this test again.");
} else {
  const monthRevenue = sales.data.monthly?.reduce((s, m) => s + m.revenue, 0);
  check("7  sample sales report has totals that add up", sales.status === 200 && Math.abs(monthRevenue - sales.data.summary.revenue) < 0.01, sales);

  const fc = await call("/api/admin/forecast?source=sample", admin);
  check("8  sample forecast returns 104 weeks of data", fc.status === 200 && fc.data.weeksOfData === 104, fc);
  const list = fc.data.products || [];
  check("9  every product has a status and 4 forecast weeks", list.length > 0 && list.every((p) => ["ok", "insufficient"].includes(p.status) && p.forecast.length === 4), fc);
  check("10 every trained product reports MAE, RMSE and 3 methods", list.filter((p) => p.status === "ok").every((p) => p.metrics.randomForest.mae >= 0 && p.metrics.naive && p.metrics.movingAverage), fc);

  // Demo orders must stay out of the real screens
  const ord = await call("/api/admin/orders", admin);
  check("11 demo orders do not appear in the admin order list", ord.status === 200 && ord.data.every((o) => o.isSample !== true), ord);
  const dash = await call("/api/admin/dashboard", admin);
  const total = Object.values(dash.data.counts || {}).reduce((a, b) => a + b, 0);
  check("12 demo orders are not counted on the dashboard", dash.status === 200 && total < 1000, dash);
}

// The default dataset follows INCLUDE_DEMO_DATA in backend/.env
const demoOn = process.env.INCLUDE_DEMO_DATA === "true";
const def = await call("/api/admin/forecast", admin);
check(`14 default dataset follows INCLUDE_DEMO_DATA (${demoOn ? "demo orders included" : "real orders only"})`, def.status === 200 && (def.data.source === (demoOn ? "all" : "real")), def);
const all = await call("/api/admin/reports/sales?source=all", admin);
check("15 source=all works", all.status === 200 && typeof all.data.summary?.revenue === "number", all);
const realSales = await call("/api/admin/reports/sales?source=real", admin);
check("16 source=real never includes demo orders", realSales.status === 200 && realSales.data.includesDemoData === false, realSales);

// The dashboard overview
const overview = await call("/api/admin/dashboard", admin);
const o = overview.data;
check(
  "17 dashboard overview has counts, month totals and the three lists",
  overview.status === 200 &&
    ["Pending", "On Process", "Completed"].every((k) => typeof o.counts?.[k] === "number") &&
    typeof o.month?.revenue === "number" &&
    typeof o.ordersToday === "number" &&
    Array.isArray(o.needsAttention) && Array.isArray(o.awaitingDownPayment) && Array.isArray(o.recent),
  overview
);
check("18 dashboard lists never include demo orders", [...(o.needsAttention || []), ...(o.recent || [])].every((x) => x.contactName !== "Sample Customer"), overview);
r = await call("/api/admin/dashboard", customer);
check("19 a customer cannot read the dashboard (403)", r.status === 403, r);
r = await call("/api/admin/dashboard?source=bogus", admin);
check("20 dashboard rejects an invalid source (400)", r.status === 400, r);

// Real data may be empty, and that must not be an error
const real = await call("/api/admin/forecast?source=real", admin);
check("13 real-data forecast works even with little or no data", real.status === 200 && Array.isArray(real.data.products), real);

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
